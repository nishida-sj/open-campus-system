import { NextResponse } from 'next/server';
import { Client, validateSignature, WebhookEvent, TextMessage } from '@line/bot-sdk';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';
import { generateAIResponse, isApplicationRelated, isUrgentQuestion } from '@/lib/ai-response';
import { saveMessage, getConversationHistory, clearConversationHistory } from '@/lib/conversation-history';
import { emergencyContact } from '@/lib/school-knowledge';

// Next.js Route Handler設定
export const runtime = 'nodejs'; // Node.js Runtimeを使用
export const dynamic = 'force-dynamic'; // キャッシュを無効化
export const revalidate = 0; // 常に最新のレスポンスを返す

// LINE Client設定
const client = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
  channelSecret: process.env.LINE_CHANNEL_SECRET!,
});

// GETリクエスト対応（エンドポイント確認用）
export async function GET() {
  console.log('=== GET request to LINE webhook endpoint ===');
  return NextResponse.json({
    status: 'ok',
    message: 'LINE Webhook endpoint is working',
    timestamp: new Date().toISOString()
  });
}

// 手動で署名検証を行う関数
function verifySignature(body: string, signature: string, secret: string): boolean {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('base64');
  return hash === signature;
}

export async function POST(request: Request) {
  // 最初に必ずログ出力
  console.log('=== POST request received at LINE webhook endpoint ===');
  console.log('Timestamp:', new Date().toISOString());

  // デバッグモード（一時的に署名検証をスキップ）
  const DEBUG_MODE = false; // 本番環境では必ず false にする

  try {
    // リクエストボディを取得（生のテキストとして）
    const body = await request.text();
    const signature = request.headers.get('x-line-signature');

    // すべてのヘッダーをログ出力
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // デバッグログ - 詳細情報
    console.log('=== LINE Webhook Request Details ===');
    console.log('Headers:', JSON.stringify(headers, null, 2));
    console.log('Body:', body);
    console.log('Body length:', body.length);
    console.log('Signature:', signature);
    console.log('CHANNEL_SECRET exists:', !!process.env.LINE_CHANNEL_SECRET);
    console.log('CHANNEL_SECRET first 10 chars:', process.env.LINE_CHANNEL_SECRET?.substring(0, 10));

    if (DEBUG_MODE) {
      console.log('🔧 DEBUG MODE: Skipping signature validation');

      // イベントを解析
      const events: WebhookEvent[] = JSON.parse(body).events;
      console.log('Events count:', events?.length || 0);

      // イベントが空の場合も200を返す
      if (!events || events.length === 0) {
        console.log('Empty events array - returning 200 OK (DEBUG MODE)');
        return NextResponse.json({ success: true, debug: true });
      }

      // 各イベントを処理
      await Promise.all(events.map(handleEvent));

      console.log('All events processed successfully (DEBUG MODE)');
      return NextResponse.json({ success: true, debug: true });
    }

    // 通常モード（署名検証あり）
    // 署名ヘッダーチェック
    if (!signature) {
      console.error('ERROR: No x-line-signature header');
      return NextResponse.json({ error: 'Unauthorized: No signature' }, { status: 401 });
    }

    // 環境変数チェック
    if (!process.env.LINE_CHANNEL_SECRET) {
      console.error('ERROR: LINE_CHANNEL_SECRET not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // 署名検証（2つの方法で試す）
    const isValidSDK = validateSignature(body, process.env.LINE_CHANNEL_SECRET, signature);
    const isValidManual = verifySignature(body, signature, process.env.LINE_CHANNEL_SECRET);

    console.log('Signature validation (SDK):', isValidSDK);
    console.log('Signature validation (Manual):', isValidManual);

    if (!isValidSDK && !isValidManual) {
      console.error('ERROR: Signature validation failed');
      console.error('Received signature:', signature.substring(0, 30) + '...');
      console.error('Body sample:', body.substring(0, 100));
      return NextResponse.json({ error: 'Unauthorized: Invalid signature' }, { status: 401 });
    }

    console.log('✅ Signature validation passed!');

    // イベントを解析
    const events: WebhookEvent[] = JSON.parse(body).events;

    console.log('Events count:', events?.length || 0);

    // イベントが空の場合（Webhook検証時など）も200を返す
    if (!events || events.length === 0) {
      console.log('Empty events array - returning 200 OK');
      return NextResponse.json({ success: true });
    }

    // 各イベントを処理
    await Promise.all(events.map(handleEvent));

    console.log('All events processed successfully');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// イベント処理
async function handleEvent(event: WebhookEvent) {
  console.log('Event received:', event.type);
  console.log('Event details:', JSON.stringify(event, null, 2));

  // followイベント（友達追加時）
  if (event.type === 'follow') {
    console.log('Processing follow event');
    await handleFollow(event);
    return;
  }

  // messageイベント（メッセージ受信時）
  if (event.type === 'message') {
    console.log('Message event detected');
    console.log('Message type:', event.message.type);

    if (event.message.type === 'text') {
      console.log('Text message confirmed, calling handleMessage');
      await handleMessage(event);
    } else {
      console.log('Non-text message type, skipping');
    }
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

  // ウェルカムメッセージを送信（AI機能の案内を追加）
  const welcomeMessage: TextMessage = {
    type: 'text',
    text: 'ご登録ありがとうございます！🎉\n\n【できること】\n✅ オープンキャンパスの申込\n✅ 学校に関する質問への自動回答（AI搭載）\n✅ イベント情報のお知らせ\n\n【申込済みの方】\n申込時に発行された申込番号（64文字）を送信してください。\n\n【質問がある方】\nお気軽にメッセージしてください。AIが24時間対応いたします🤖\n\n例）「アクセスを教えて」「学費について知りたい」',
  };

  try {
    await client.pushMessage(userId, welcomeMessage);
  } catch (error) {
    console.error('Failed to send welcome message:', error);
  }
}

// メッセージイベント処理（統合版：トークン検証 + AI自動応答）
async function handleMessage(event: WebhookEvent & { type: 'message' }) {
  const userId = event.source.userId;
  const message = event.message;

  if (!userId || message.type !== 'text') {
    return;
  }

  const userMessage = message.text.trim();

  // 受信したメッセージをログ出力（デバッグ用）
  console.log('Received message from user:', userId);
  console.log('Message text:', userMessage);

  // 1. トークン形式チェック（64文字の16進数）
  const cleanedToken = userMessage.replace(/\s/g, ''); // 空白文字を削除

  if (/^[a-f0-9]{64}$/i.test(cleanedToken)) {
    // トークン形式の場合 → 既存の申込完了処理
    console.log('Token format detected, processing application...');
    await handleTokenVerification(event, cleanedToken);
    return;
  }

  // 2. トークン以外の場合 → AI自動応答処理
  console.log('Regular message detected, processing AI response...');
  await handleAIResponse(event, userMessage);
}

// トークン検証処理（既存の処理を関数化）
async function handleTokenVerification(
  event: WebhookEvent & { type: 'message' },
  token: string
) {
  const userId = event.source.userId;

  if (!userId) {
    console.error('No userId in token verification event');
    return;
  }

  console.log('Searching for applicant with token:', token);

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
    console.error('Applicant not found - Error:', error);
    console.error('Search token:', token);

    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '申込番号が見つかりませんでした。\n\n番号を再度確認して入力してください。',
    });
    return;
  }

  console.log('✅ Found applicant:', applicant.id, '-', applicant.name);
  console.log('Current status:', applicant.status);
  console.log('Token expires at:', applicant.token_expires_at);

  // トークン有効期限チェック
  const expiresAt = new Date(applicant.token_expires_at);
  const now = new Date();

  console.log('Checking token expiration...');
  console.log('Current time:', now.toISOString());
  console.log('Expires at:', expiresAt.toISOString());

  if (now > expiresAt) {
    console.log('❌ Token expired');
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '申込番号の有効期限が切れています。\n\nお手数ですが、再度お申し込みをお願いします。',
    });
    return;
  }

  console.log('✅ Token is still valid');

  // 既に登録済みかチェック
  if (applicant.status === 'completed') {
    console.log('ℹ️ Applicant already completed');
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'この申込番号は既に登録済みです。\n\nご不明な点がございましたら、お問い合わせください。',
    });
    return;
  }

  console.log('✅ Applicant status is pending, proceeding with registration');

  // LINE User IDとステータスを更新（同じLINEユーザーが複数のOCに参加可能）
  console.log('Updating applicant:', applicant.id);
  console.log('Setting line_user_id to:', userId);

  const { error: updateError } = await supabaseAdmin
    .from('applicants')
    .update({
      line_user_id: userId,
      status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', applicant.id);

  if (updateError) {
    console.error('Failed to update applicant - Error details:', updateError);
    console.error('Error message:', updateError.message);
    console.error('Error code:', updateError.code);
    console.error('Error details:', updateError.details);

    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '登録処理中にエラーが発生しました。\n\nしばらく時間をおいて再度お試しください。',
    });
    return;
  }

  console.log('✅ Successfully updated applicant status to completed with line_user_id');

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

// ===================================================
// AI自動応答処理（新機能）
// ===================================================

/**
 * AI自動応答処理
 */
async function handleAIResponse(
  event: WebhookEvent & { type: 'message' },
  userMessage: string
) {
  const userId = event.source.userId!;

  try {
    // 1. 特殊コマンドの処理
    if (userMessage === 'リセット' || userMessage === 'reset' || userMessage.toLowerCase() === 'reset') {
      await clearConversationHistory(userId);
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '会話履歴をリセットしました。\n新しく質問をどうぞ！😊',
      });
      return;
    }

    // 2. 緊急の質問の場合
    if (isUrgentQuestion(userMessage)) {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: `お急ぎのご用件ですね。\n恐れ入りますが、直接お電話でお問い合わせいただけますでしょうか。\n\n📞 TEL: ${emergencyContact.phone}\n⏰ 受付時間: ${emergencyContact.hours}\n\n担当者が直接対応させていただきます。`,
      });
      return;
    }

    // 3. 申込関連の質問の場合
    if (isApplicationRelated(userMessage)) {
      // ユーザーの申込情報を確認
      const { data: applicant } = await supabaseAdmin
        .from('applicants')
        .select('*, open_campus_dates(date)')
        .eq('line_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (applicant) {
        const visitDate = applicant.open_campus_dates?.date
          ? new Date(applicant.open_campus_dates.date).toLocaleDateString('ja-JP', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'short',
            })
          : '未定';

        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: `【現在のお申し込み状況】\n\n📅 参加予定日: ${visitDate}\n✅ 受付完了しています\n\n【キャンセル・変更について】\nお手数ですが、お電話でお問い合わせください。\n📞 TEL: ${emergencyContact.phone}\n⏰ 受付時間: ${emergencyContact.hours}`,
        });
      } else {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: `オープンキャンパスのお申し込みは、\nWebサイトから可能です。\n\n詳しくは以下からお問い合わせください。\n📞 TEL: ${emergencyContact.phone}\n⏰ 受付時間: ${emergencyContact.hours}`,
        });
      }
      return;
    }

    // 4. 通常のAI応答
    // 会話履歴を取得
    const history = await getConversationHistory(userId, 10);

    // AI応答生成
    const result = await generateAIResponse(userId, userMessage, history);

    if (!result.success) {
      // 使用量制限に達した場合
      if (result.usageLimited) {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: `申し訳ございません。現在、自動応答機能の利用制限に達しています。\n\nお問い合わせは以下までお願いいたします。\n📞 TEL: ${emergencyContact.phone}\n⏰ 受付時間: ${emergencyContact.hours}`,
        });
      } else {
        // その他のエラー
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: result.error || '申し訳ございません。一時的にエラーが発生しました。\nしばらくしてからもう一度お試しください。',
        });
      }
      return;
    }

    // 5. AI応答を送信
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: result.response!,
    });

    // 6. 会話履歴を保存
    await saveMessage(userId, 'user', userMessage);
    await saveMessage(userId, 'assistant', result.response!);

    console.log('AI response sent successfully');
  } catch (error) {
    console.error('Error in handleAIResponse:', error);
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '申し訳ございません。一時的にエラーが発生しました。\nしばらくしてからもう一度お試しください。',
    });
  }
}
