import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// メール送信関数（Resend使用）
async function sendEmail(to: string, subject: string, message: string) {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY が設定されていません');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'noreply@example.com',
      to: [to],
      subject: subject,
      text: message,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`メール送信エラー: ${JSON.stringify(error)}`);
  }

  return response.json();
}

// LINE メッセージ送信関数
async function sendLineMessage(userId: string, message: string) {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!channelAccessToken) {
    throw new Error('LINE_CHANNEL_ACCESS_TOKEN が設定されていません');
  }

  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [
        {
          type: 'text',
          text: message,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LINEメッセージ送信エラー: ${error}`);
  }

  return response.json();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, applicant_ids, subject, message } = body;

    console.log('配信リクエスト:', { type, applicant_count: applicant_ids?.length });

    if (!type || !applicant_ids || !Array.isArray(applicant_ids) || !message) {
      return NextResponse.json(
        { error: '必要なパラメータが不足しています' },
        { status: 400 }
      );
    }

    if (type === 'email' && !subject) {
      return NextResponse.json({ error: '件名が必要です' }, { status: 400 });
    }

    // 環境変数チェック
    if (type === 'email' && !process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY が設定されていません');
      return NextResponse.json(
        { error: 'メール送信設定が完了していません。管理者に連絡してください。' },
        { status: 500 }
      );
    }

    if (type === 'line' && !process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      console.error('LINE_CHANNEL_ACCESS_TOKEN が設定されていません');
      return NextResponse.json(
        { error: 'LINE送信設定が完了していません。管理者に連絡してください。' },
        { status: 500 }
      );
    }

    // 申込者情報を取得
    const { data: applicants, error: applicantsError } = await supabaseAdmin
      .from('applicants')
      .select('id, name, email, line_user_id')
      .in('id', applicant_ids);

    if (applicantsError) {
      console.error('申込者取得エラー:', applicantsError);
      return NextResponse.json(
        { error: '申込者情報の取得に失敗しました' },
        { status: 500 }
      );
    }

    const results = {
      success_count: 0,
      failed_count: 0,
      errors: [] as string[],
    };

    const recipients: any[] = [];

    // メッセージ送信
    for (const applicant of applicants || []) {
      try {
        if (type === 'email') {
          if (!applicant.email) {
            results.failed_count++;
            results.errors.push(`${applicant.name}: メールアドレスなし`);
            recipients.push({ id: applicant.id, name: applicant.name, status: 'failed' });
            continue;
          }
          console.log(`メール送信開始: ${applicant.email}`);
          await sendEmail(applicant.email, subject, message);
          console.log(`メール送信成功: ${applicant.email}`);
          results.success_count++;
          recipients.push({ id: applicant.id, name: applicant.name, email: applicant.email, status: 'success' });
        } else if (type === 'line') {
          if (!applicant.line_user_id) {
            results.failed_count++;
            results.errors.push(`${applicant.name}: LINE未連携`);
            recipients.push({ id: applicant.id, name: applicant.name, status: 'failed' });
            continue;
          }
          console.log(`LINE送信開始: ${applicant.name}`);
          await sendLineMessage(applicant.line_user_id, message);
          console.log(`LINE送信成功: ${applicant.name}`);
          results.success_count++;
          recipients.push({ id: applicant.id, name: applicant.name, status: 'success' });
        }
      } catch (error) {
        console.error(`送信エラー (${applicant.name}):`, error);
        results.failed_count++;
        const errorMessage = error instanceof Error ? error.message : '送信失敗';
        results.errors.push(`${applicant.name}: ${errorMessage}`);
        recipients.push({ id: applicant.id, name: applicant.name, status: 'failed', error: errorMessage });
      }
    }

    // 送信履歴を保存
    try {
      const { error: historyError } = await supabaseAdmin
        .from('broadcast_history')
        .insert({
          type,
          subject: type === 'email' ? subject : null,
          message,
          recipient_count: applicant_ids.length,
          success_count: results.success_count,
          failed_count: results.failed_count,
          recipients,
          errors: results.errors.length > 0 ? results.errors : null,
        });

      if (historyError) {
        console.error('履歴保存エラー:', historyError);
      }
    } catch (historyError) {
      console.error('履歴保存例外:', historyError);
    }

    return NextResponse.json({
      success_count: results.success_count,
      failed_count: results.failed_count,
      errors: results.errors,
    });
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({
      error: 'サーバーエラー',
      details: error instanceof Error ? error.message : '不明なエラー'
    }, { status: 500 });
  }
}
