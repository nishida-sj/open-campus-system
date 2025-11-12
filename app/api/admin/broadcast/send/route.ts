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

    if (!type || !applicant_ids || !Array.isArray(applicant_ids) || !message) {
      return NextResponse.json(
        { error: '必要なパラメータが不足しています' },
        { status: 400 }
      );
    }

    if (type === 'email' && !subject) {
      return NextResponse.json({ error: '件名が必要です' }, { status: 400 });
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

    // メッセージ送信
    for (const applicant of applicants || []) {
      try {
        if (type === 'email') {
          if (!applicant.email) {
            results.failed_count++;
            results.errors.push(`${applicant.name}: メールアドレスなし`);
            continue;
          }
          await sendEmail(applicant.email, subject, message);
          results.success_count++;
        } else if (type === 'line') {
          if (!applicant.line_user_id) {
            results.failed_count++;
            results.errors.push(`${applicant.name}: LINE未連携`);
            continue;
          }
          await sendLineMessage(applicant.line_user_id, message);
          results.success_count++;
        }
      } catch (error) {
        console.error(`送信エラー (${applicant.name}):`, error);
        results.failed_count++;
        results.errors.push(
          `${applicant.name}: ${error instanceof Error ? error.message : '送信失敗'}`
        );
      }
    }

    return NextResponse.json({
      success_count: results.success_count,
      failed_count: results.failed_count,
      errors: results.errors,
    });
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
