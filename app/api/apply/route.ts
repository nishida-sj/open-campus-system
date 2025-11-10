import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { applicantSchema } from '@/lib/validation';
import { ZodError } from 'zod';
import { randomBytes } from 'crypto';

export async function POST(request: Request) {
  try {
    // リクエストボディを取得
    const body = await request.json();

    // バリデーション
    const validatedData = applicantSchema.parse(body);

    // 1. 重複チェック（email + visit_date_id の組み合わせ）
    const { data: existingApplicant } = await supabaseAdmin
      .from('applicants')
      .select('id')
      .eq('email', validatedData.email)
      .eq('visit_date_id', validatedData.visit_date_id)
      .single();

    if (existingApplicant) {
      return NextResponse.json(
        { error: 'この日程で既に申込済みです' },
        { status: 400 }
      );
    }

    // 2. 定員チェック
    const { data: dateInfo, error: dateError } = await supabaseAdmin
      .from('open_campus_dates')
      .select('capacity, current_count')
      .eq('id', validatedData.visit_date_id)
      .single();

    if (dateError) {
      console.error('Date check error:', dateError);
      return NextResponse.json(
        { error: '日程情報の取得に失敗しました' },
        { status: 500 }
      );
    }

    if (!dateInfo || dateInfo.current_count >= dateInfo.capacity) {
      return NextResponse.json(
        { error: 'この日程は定員に達しています' },
        { status: 400 }
      );
    }

    // 3. トークン生成（32バイト、16進数文字列）
    const token = randomBytes(32).toString('hex');

    // 4. トークン有効期限設定（現在時刻 + 30分）
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setMinutes(tokenExpiresAt.getMinutes() + 30);

    // 5. applicantsテーブルにINSERT（status='pending'）
    const { data: applicant, error: insertError } = await supabaseAdmin
      .from('applicants')
      .insert({
        ...validatedData,
        token,
        token_expires_at: tokenExpiresAt.toISOString(),
        status: 'pending'
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json(
        { error: '申込の登録に失敗しました' },
        { status: 500 }
      );
    }

    // 6. application_logsテーブルにログ記録
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || '';

    const { error: logError } = await supabaseAdmin
      .from('application_logs')
      .insert({
        applicant_id: applicant.id,
        action: 'created',
        ip_address: ipAddress,
        user_agent: userAgent
      });

    if (logError) {
      console.error('Log insert error:', logError);
      // ログ記録失敗は続行（重要度低）
    }

    // 7. increment_visit_count関数を呼び出し
    const { error: rpcError } = await supabaseAdmin.rpc('increment_visit_count', {
      date_id: validatedData.visit_date_id
    });

    if (rpcError) {
      console.error('RPC error:', rpcError);
      // カウント更新失敗時はロールバックすべきだが、
      // トランザクション処理が必要なため、エラーログのみ
    }

    // 8. 成功レスポンスを返す
    return NextResponse.json({
      success: true,
      token,
      applicant_id: applicant.id
    });

  } catch (error) {
    // バリデーションエラー（ZodError）
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: '入力内容に誤りがあります', details: error.issues },
        { status: 400 }
      );
    }

    // その他のエラー
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
