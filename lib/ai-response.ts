/**
 * AI応答ロジック（テナント対応）
 * OpenAI GPT-4o-mini との統合
 */

import OpenAI from 'openai';
import { isApplicationRelated, isUrgentQuestion } from './school-knowledge';
import { checkUsageLimit, logUsage, getAISetting } from './usage-monitor';
import { supabaseAdmin } from './supabase';
import type { Tenant } from './tenant';

// プロンプトキャッシュ（テナントごと・5分間有効）
const promptCache = new Map<string, { prompt: string; cachedAt: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5分

// OpenAIクライアントキャッシュ（テナントごと）
const openaiClients = new Map<string, OpenAI>();

/**
 * テナント用のOpenAIクライアントを取得
 */
function getOpenAIClient(tenant: Tenant): OpenAI {
  const apiKey = tenant.openai_api_key || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // キーが同じならキャッシュを使用
  const cached = openaiClients.get(tenant.id);
  if (cached) {
    return cached;
  }

  const client = new OpenAI({ apiKey });
  openaiClients.set(tenant.id, client);
  return client;
}

/**
 * テナント別の緊急連絡先を取得
 */
export async function getEmergencyContact(tenantId: string): Promise<{
  phone: string;
  hours: string;
  email: string;
}> {
  try {
    const { data: settings } = await supabaseAdmin
      .from('site_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return {
      phone: settings?.phone || '03-XXXX-XXXX',
      hours: settings?.business_hours || '平日 9:00-17:00',
      email: settings?.email || 'info@example.jp',
    };
  } catch {
    return {
      phone: '03-XXXX-XXXX',
      hours: '平日 9:00-17:00',
      email: 'info@example.jp',
    };
  }
}

/**
 * 動的プロンプトをDBから取得（キャッシュ付き）
 */
async function fetchSystemPrompt(tenantId: string): Promise<string> {
  try {
    const now = Date.now();
    const cached = promptCache.get(tenantId);
    if (cached && now - cached.cachedAt < CACHE_DURATION) {
      return cached.prompt;
    }

    // DB からプロンプト設定を直接取得
    const { data: promptSetting } = await supabaseAdmin
      .from('ai_settings')
      .select('setting_value')
      .eq('tenant_id', tenantId)
      .eq('setting_key', 'system_prompt')
      .single();

    if (promptSetting?.setting_value) {
      promptCache.set(tenantId, { prompt: promptSetting.setting_value, cachedAt: now });
      return promptSetting.setting_value;
    }

    // フォールバック
    const contact = await getEmergencyContact(tenantId);
    const fallback = `あなたは学校の公式LINEアカウントのAIアシスタントです。
以下のルールに従って回答してください：

【回答ルール】
- 常に丁寧で親しみやすい口調で話す
- 絵文字を適度に使用（1-2個/メッセージ）
- 長文は避け、簡潔に（200文字以内推奨）
- 不確かな情報は提供しない

【重要】回答できない場合の対応
申し訳ございませんが、その質問にはお答えできません。
お電話でお問い合わせください。

📞 ${contact.phone}
⏰ ${contact.hours}`;

    promptCache.set(tenantId, { prompt: fallback, cachedAt: now });
    return fallback;
  } catch (error) {
    console.error('Error fetching system prompt:', error);
    return 'あなたは学校の公式LINEアカウントのAIアシスタントです。丁寧に回答してください。';
  }
}

export interface AIResponseResult {
  success: boolean;
  response?: string;
  error?: string;
  usageLimited?: boolean;
}

/**
 * AI応答を生成（テナント対応版）
 */
export async function generateAIResponse(
  tenant: Tenant,
  lineUserId: string,
  userMessage: string,
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[]
): Promise<AIResponseResult> {
  try {
    // 1. 使用量制限チェック
    const limitCheck = await checkUsageLimit(tenant.id);

    if (!limitCheck.allowed) {
      return {
        success: false,
        error: limitCheck.reason || '使用量制限に達しました',
        usageLimited: true,
      };
    }

    // 2. システムプロンプトを動的に取得
    const systemPrompt = await fetchSystemPrompt(tenant.id);

    // 3. メッセージ構築
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-10);
      messages.push(
        ...recentHistory.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }))
      );
    }

    messages.push({ role: 'user', content: userMessage });

    // 4. パラメータ取得
    const temperature = parseFloat((await getAISetting(tenant.id, 'temperature')) || '0.7');
    const maxTokens = parseInt((await getAISetting(tenant.id, 'max_tokens')) || '500');

    // 5. OpenAI API呼び出し
    const openai = getOpenAIClient(tenant);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: temperature,
      max_tokens: maxTokens,
    });

    const response = completion.choices[0].message.content;
    const usage = completion.usage;

    if (!response || !usage) {
      throw new Error('Invalid API response');
    }

    // 6. 使用量をログ記録
    await logUsage(tenant.id, lineUserId, usage.prompt_tokens, usage.completion_tokens, usage.total_tokens, true);

    return { success: true, response };
  } catch (error) {
    console.error('OpenAI API error:', error);

    await logUsage(tenant.id, lineUserId, 0, 0, 0, false, error instanceof Error ? error.message : 'Unknown error');

    const contact = await getEmergencyContact(tenant.id);

    if (error instanceof Error) {
      if (error.message.includes('rate_limit')) {
        return {
          success: false,
          error: 'ただいま多くのお問い合わせをいただいており、少々お時間をいただいております。しばらくしてからもう一度お試しください🙇',
        };
      }
    }

    return {
      success: false,
      error: `申し訳ございません。一時的にシステムエラーが発生しております。\n\nお急ぎの場合は、お電話でお問い合わせください。\n📞 ${contact.phone}\n⏰ ${contact.hours}`,
    };
  }
}

/**
 * プロンプトキャッシュをクリア
 */
export function clearPromptCache(tenantId?: string): void {
  if (tenantId) {
    promptCache.delete(tenantId);
  } else {
    promptCache.clear();
  }
  console.log('Prompt cache cleared');
}

/**
 * トークン使用量の概算計算
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length * 2);
}

export { isApplicationRelated, isUrgentQuestion };
