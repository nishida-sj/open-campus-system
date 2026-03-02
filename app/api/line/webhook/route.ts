import { NextResponse } from 'next/server';
import { Client, WebhookEvent, TextMessage } from '@line/bot-sdk';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';
import { generateAIResponse, isApplicationRelated, isUrgentQuestion, getEmergencyContact } from '@/lib/ai-response';
import { saveMessage, getConversationHistory, clearConversationHistory } from '@/lib/conversation-history';
import { canUseAIInMaintenanceMode, verifyAndAddTester } from '@/lib/usage-monitor';
import { getAllActiveTenants, type Tenant } from '@/lib/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GETリクエスト対応（エンドポイント確認用）
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'LINE Webhook endpoint is working (multi-tenant)',
    timestamp: new Date().toISOString()
  });
}

// 署名検証
function verifySignature(body: string, signature: string, secret: string): boolean {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('base64');
  return hash === signature;
}

/**
 * テナントをchannel_secretの署名検証で特定
 */
async function identifyTenant(body: string, signature: string): Promise<Tenant | null> {
  const tenants = await getAllActiveTenants();

  for (const tenant of tenants) {
    if (!tenant.line_channel_secret) continue;

    const isValid = verifySignature(body, signature, tenant.line_channel_secret);
    if (isValid) {
      console.log(`✅ Tenant identified: ${tenant.slug}`);
      return tenant;
    }
  }

  // フォールバック: 環境変数のchannel_secretで検証
  const envSecret = process.env.LINE_CHANNEL_SECRET;
  if (envSecret) {
    const isValid = verifySignature(body, signature, envSecret);
    if (isValid) {
      console.log('✅ Signature matched with env LINE_CHANNEL_SECRET, using first tenant');
      return tenants[0] || null;
    }
  }

  return null;
}

/**
 * テナント用のLINEクライアントを生成
 */
function createLineClient(tenant: Tenant): Client {
  return new Client({
    channelAccessToken: tenant.line_channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN!,
    channelSecret: tenant.line_channel_secret || process.env.LINE_CHANNEL_SECRET!,
  });
}

export async function POST(request: Request) {
  console.log('=== POST request received at LINE webhook endpoint ===');

  try {
    const body = await request.text();
    const signature = request.headers.get('x-line-signature');

    if (!signature) {
      console.error('ERROR: No x-line-signature header');
      return NextResponse.json({ error: 'Unauthorized: No signature' }, { status: 401 });
    }

    // テナントを署名で特定
    const tenant = await identifyTenant(body, signature);
    if (!tenant) {
      console.error('ERROR: No tenant matched for signature');
      return NextResponse.json({ error: 'Unauthorized: Invalid signature' }, { status: 401 });
    }

    console.log(`Tenant: ${tenant.slug} (${tenant.name})`);

    const events: WebhookEvent[] = JSON.parse(body).events;

    if (!events || events.length === 0) {
      return NextResponse.json({ success: true });
    }

    const client = createLineClient(tenant);

    await Promise.all(events.map(event => handleEvent(event, tenant, client)));

    console.log('All events processed successfully');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// イベント処理
async function handleEvent(event: WebhookEvent, tenant: Tenant, client: Client) {
  console.log('Event received:', event.type, 'for tenant:', tenant.slug);

  if (event.type === 'follow') {
    await handleFollow(event, tenant, client);
    return;
  }

  if (event.type === 'message') {
    if (event.message.type === 'text') {
      await handleMessage(event, tenant, client);
    }
  }
}

// 友達追加イベント処理
async function handleFollow(event: WebhookEvent & { type: 'follow' }, tenant: Tenant, client: Client) {
  const userId = event.source.userId;
  if (!userId) return;

  console.log('New friend added:', userId, 'for tenant:', tenant.slug);

  const welcomeMessage: TextMessage = {
    type: 'text',
    text: `ご登録ありがとうございます！🎉\n\n${tenant.display_name}の公式LINEです。\n\n【できること】\n✅ オープンキャンパスの申込\n✅ 学校に関する質問への自動回答（AI搭載）\n✅ イベント情報のお知らせ\n\n【申込済みの方】\n申込時に発行された申込番号（64文字）を送信してください。\n\n【質問がある方】\nお気軽にメッセージしてください。AIが24時間対応いたします🤖`,
  };

  try {
    await client.pushMessage(userId, welcomeMessage);
  } catch (error) {
    console.error('Failed to send welcome message:', error);
  }
}

// メッセージイベント処理
async function handleMessage(event: WebhookEvent & { type: 'message' }, tenant: Tenant, client: Client) {
  const userId = event.source.userId;
  const message = event.message;

  if (!userId || message.type !== 'text') return;

  const userMessage = message.text.trim();

  // 1. トークン形式チェック（64文字の16進数）
  const cleanedToken = userMessage.replace(/\s/g, '');

  if (/^[a-f0-9]{64}$/i.test(cleanedToken)) {
    await handleTokenVerification(event, cleanedToken, tenant, client);
    return;
  }

  // 2. AI自動応答処理
  await handleAIResponse(event, userMessage, tenant, client);
}

// トークン検証処理
async function handleTokenVerification(
  event: WebhookEvent & { type: 'message' },
  token: string,
  tenant: Tenant,
  client: Client
) {
  const userId = event.source.userId;
  if (!userId) return;

  const { data: applicant, error } = await supabaseAdmin
    .from('applicants')
    .select('id, name, email, phone, visit_date_id, token, token_expires_at, status, line_user_id')
    .eq('tenant_id', tenant.id)
    .eq('token', token)
    .single();

  if (error || !applicant) {
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '申込番号が見つかりませんでした。\n\n番号を再度確認して入力してください。',
    });
    return;
  }

  const expiresAt = new Date(applicant.token_expires_at);
  if (new Date() > expiresAt) {
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '申込番号の有効期限が切れています。\n\nお手数ですが、再度お申し込みをお願いします。',
    });
    return;
  }

  if (applicant.status === 'completed') {
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'この申込番号は既に登録済みです。\n\nご不明な点がございましたら、お問い合わせください。',
    });
    return;
  }

  const { error: updateError } = await supabaseAdmin
    .from('applicants')
    .update({ line_user_id: userId, status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', applicant.id)
    .eq('tenant_id', tenant.id);

  if (updateError) {
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '登録処理中にエラーが発生しました。\n\nしばらく時間をおいて再度お試しください。',
    });
    return;
  }

  await supabaseAdmin.from('application_logs').insert({
    tenant_id: tenant.id,
    applicant_id: applicant.id,
    action: 'line_registered',
    ip_address: 'LINE',
    user_agent: 'LINE Bot',
  });

  const { data: dateInfo } = await supabaseAdmin
    .from('open_campus_dates')
    .select('date')
    .eq('id', applicant.visit_date_id)
    .single();

  const visitDate = dateInfo
    ? new Date(dateInfo.date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
    : '未定';

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

// AI自動応答処理
async function handleAIResponse(
  event: WebhookEvent & { type: 'message' },
  userMessage: string,
  tenant: Tenant,
  client: Client
) {
  const userId = event.source.userId!;
  const contact = await getEmergencyContact(tenant.id);

  try {
    // 1. 特殊コマンド
    if (userMessage === 'リセット' || userMessage.toLowerCase() === 'reset') {
      await clearConversationHistory(tenant.id, userId);
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '会話履歴をリセットしました。\n新しく質問をどうぞ！😊',
      });
      return;
    }

    // テスター登録コマンド
    const testerRegisterMatch = userMessage.match(/^テスター登録\s+([A-Za-z0-9]+)$/);
    if (testerRegisterMatch) {
      const code = testerRegisterMatch[1];
      const result = await verifyAndAddTester(tenant.id, code, userId);

      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: result.success
          ? `✅ ${result.message}\n\nメンテナンスモード中でもAI機能をご利用いただけます。`
          : `❌ ${result.message}\n\n正しい招待コードを入力してください。`,
      });
      return;
    }

    // メンテナンスモードチェック
    const maintenanceCheck = await canUseAIInMaintenanceMode(tenant.id, userId);
    if (maintenanceCheck.maintenanceMode && !maintenanceCheck.allowed) {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: `現在、AI自動応答機能はメンテナンス中です。\n\nお問い合わせは以下までお願いいたします。\n📞 TEL: ${contact.phone}\n⏰ 受付時間: ${contact.hours}`,
      });
      return;
    }

    // 緊急の質問
    if (isUrgentQuestion(userMessage)) {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: `お急ぎのご用件ですね。\n恐れ入りますが、直接お電話でお問い合わせいただけますでしょうか。\n\n📞 TEL: ${contact.phone}\n⏰ 受付時間: ${contact.hours}\n\n担当者が直接対応させていただきます。`,
      });
      return;
    }

    // 申込関連の質問
    if (isApplicationRelated(userMessage)) {
      const { data: applicant } = await supabaseAdmin
        .from('applicants')
        .select('*, open_campus_dates(date)')
        .eq('tenant_id', tenant.id)
        .eq('line_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (applicant) {
        const visitDate = applicant.open_campus_dates?.date
          ? new Date(applicant.open_campus_dates.date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
          : '未定';

        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: `【現在のお申し込み状況】\n\n📅 参加予定日: ${visitDate}\n✅ 受付完了しています\n\n【キャンセル・変更について】\nお手数ですが、お電話でお問い合わせください。\n📞 TEL: ${contact.phone}\n⏰ 受付時間: ${contact.hours}`,
        });
      } else {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: `オープンキャンパスのお申し込みは、\nWebサイトから可能です。\n\n詳しくは以下からお問い合わせください。\n📞 TEL: ${contact.phone}\n⏰ 受付時間: ${contact.hours}`,
        });
      }
      return;
    }

    // 通常のAI応答
    const history = await getConversationHistory(tenant.id, userId, 10);
    const result = await generateAIResponse(tenant, userId, userMessage, history);

    if (!result.success) {
      if (result.usageLimited) {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: `申し訳ございません。現在、自動応答機能の利用制限に達しています。\n\nお問い合わせは以下までお願いいたします。\n📞 TEL: ${contact.phone}\n⏰ 受付時間: ${contact.hours}`,
        });
      } else {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: result.error || '申し訳ございません。一時的にエラーが発生しました。\nしばらくしてからもう一度お試しください。',
        });
      }
      return;
    }

    await client.replyMessage(event.replyToken, { type: 'text', text: result.response! });

    await saveMessage(tenant.id, userId, 'user', userMessage);
    await saveMessage(tenant.id, userId, 'assistant', result.response!);
  } catch (error) {
    console.error('Error in handleAIResponse:', error);
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '申し訳ございません。一時的にエラーが発生しました。\nしばらくしてからもう一度お試しください。',
    });
  }
}
