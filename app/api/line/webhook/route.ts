import { NextResponse } from 'next/server';
import { Client, validateSignature, WebhookEvent, TextMessage } from '@line/bot-sdk';
import { supabaseAdmin } from '@/lib/supabase';

// LINE Client設定
const client = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
  channelSecret: process.env.LINE_CHANNEL_SECRET!,
});

export async function POST(request: Request) {
  try {
    // リクエストボディを取得
    const body = await request.text();
    const signature = request.headers.get('x-line-signature');

    // LINE署名検証
    if (!signature || !validateSignature(body, process.env.LINE_CHANNEL_SECRET!, signature)) {
      console.error('Invalid signature');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // イベントを解析
    const events: WebhookEvent[] = JSON.parse(body).events;

    // 各イベントを処理
    await Promise.all(events.map(handleEvent));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// イベント処理
async function handleEvent(event: WebhookEvent) {
  console.log('Event received:', event.type);

  // followイベント（友達追加時）
  if (event.type === 'follow') {
    await handleFollow(event);
  }

  // messageイベント（メッセージ受信時）
  if (event.type === 'message' && event.message.type === 'text') {
    await handleMessage(event);
  }
}

// 友達追加イベント処理
async function handleFollow(event: WebhookEvent & { type: 'follow' }) {
  const userId = event.source.userId;

  if (!userId) {
    console.error('No userId in follow event');
    return;
  }

  console.log('New friend added:', userId);

  // ウェルカムメッセージを送信
  const welcomeMessage: TextMessage = {
    type: 'text',
    text: 'ご登録ありがとうございます！\n\nオープンキャンパスのお申し込みが完了している方は、申込時に発行された申込番号（トークン）を送信してください。\n\n申込完了後、詳しい情報をお送りします。',
  };

  try {
    await client.pushMessage(userId, welcomeMessage);
  } catch (error) {
    console.error('Failed to send welcome message:', error);
  }
}

// メッセージイベント処理（トークン検証）
async function handleMessage(event: WebhookEvent & { type: 'message' }) {
  const userId = event.source.userId;
  const message = event.message;

  if (!userId || message.type !== 'text') {
    return;
  }

  const token = message.text.trim();

  // トークンの形式チェック（64文字の16進数）
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '申込番号の形式が正しくありません。\n\n申込完了ページに表示された64文字の番号を正確に入力してください。',
    });
    return;
  }

  // トークンでapplicantを検索
  const { data: applicant, error } = await supabaseAdmin
    .from('applicants')
    .select(`
      id,
      name,
      email,
      phone,
      visit_date_id,
      token,
      token_expires_at,
      status,
      line_user_id
    `)
    .eq('token', token)
    .single();

  if (error || !applicant) {
    console.error('Applicant not found:', error);
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '申込番号が見つかりませんでした。\n\n番号を再度確認して入力してください。',
    });
    return;
  }

  // トークン有効期限チェック
  const expiresAt = new Date(applicant.token_expires_at);
  const now = new Date();

  if (now > expiresAt) {
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '申込番号の有効期限が切れています。\n\nお手数ですが、再度お申し込みをお願いします。',
    });
    return;
  }

  // 既に登録済みかチェック
  if (applicant.status === 'completed') {
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'この申込番号は既に登録済みです。\n\nご不明な点がございましたら、お問い合わせください。',
    });
    return;
  }

  // LINE User IDとステータスを更新
  const { error: updateError } = await supabaseAdmin
    .from('applicants')
    .update({
      line_user_id: userId,
      status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', applicant.id);

  if (updateError) {
    console.error('Failed to update applicant:', updateError);
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '登録処理中にエラーが発生しました。\n\nしばらく時間をおいて再度お試しください。',
    });
    return;
  }

  // ログ記録
  await supabaseAdmin.from('application_logs').insert({
    applicant_id: applicant.id,
    action: 'line_registered',
    ip_address: 'LINE',
    user_agent: 'LINE Bot',
  });

  // 参加日程情報を取得
  const { data: dateInfo } = await supabaseAdmin
    .from('open_campus_dates')
    .select('date')
    .eq('id', applicant.visit_date_id)
    .single();

  const visitDate = dateInfo
    ? new Date(dateInfo.date).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short',
      })
    : '未定';

  // 申込完了メッセージを送信
  const completionMessage: TextMessage = {
    type: 'text',
    text: `${applicant.name} 様\n\nオープンキャンパスのお申し込みが完了しました！\n\n【参加日程】\n${visitDate}\n\n【お名前】\n${applicant.name}\n\n【メールアドレス】\n${applicant.email}\n\n【電話番号】\n${applicant.phone}\n\n当日のご案内や詳細情報は、開催日が近づきましたらこちらのLINEでお知らせいたします。\n\nご不明な点やキャンセルのご連絡がございましたら、お気軽にメッセージをお送りください。\n\nご参加をお待ちしております！`,
  };

  try {
    await client.replyMessage(event.replyToken, completionMessage);
  } catch (error) {
    console.error('Failed to send completion message:', error);
  }
}
