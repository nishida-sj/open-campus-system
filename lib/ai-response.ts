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
 * 動的プロンプトをDBパーツから組み立て（キャッシュ付き）
 * ai-prompt APIと同じロジックでパーツ＋イベント情報から生成
 */
async function fetchSystemPrompt(tenantId: string): Promise<string> {
  try {
    const now = Date.now();
    const cached = promptCache.get(tenantId);
    if (cached && now - cached.cachedAt < CACHE_DURATION) {
      return cached.prompt;
    }

    // 1. プロンプトパーツを取得
    const settingsMap: Record<string, string> = {
      prompt_school_info: '',
      prompt_access: '',
      prompt_unable_response: '',
      prompt_closing_message: '',
      prompt_additional_instructions: '',
      prompt_custom_items: '[]',
      prompt_auto_append_rules: '[]',
      prompt_period_rules: '[]',
      prompt_department_sections: '[]',
    };

    const { data: settings } = await supabaseAdmin
      .from('ai_settings')
      .select('setting_key, setting_value')
      .eq('tenant_id', tenantId)
      .in('setting_key', [
        'prompt_school_info',
        'prompt_access',
        'prompt_unable_response',
        'prompt_closing_message',
        'prompt_additional_instructions',
        'prompt_custom_items',
        'prompt_auto_append_rules',
        'prompt_period_rules',
        'prompt_department_sections',
      ]);

    if (settings && settings.length > 0) {
      settings.forEach((item) => {
        settingsMap[item.setting_key] = item.setting_value || '';
      });
    }

    // 2. 有効なイベント情報を取得
    let eventPrompts = '';
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: events } = await supabaseAdmin
        .from('open_campus_events')
        .select('id, name, description, overview, is_active, display_end_date')
        .eq('tenant_id', tenantId)
        .gte('display_end_date', today)
        .eq('is_active', true)
        .order('display_end_date', { ascending: true });

      if (events && events.length > 0) {
        const eventsWithDetails = await Promise.all(
          events.map(async (event) => {
            const { data: dates } = await supabaseAdmin
              .from('open_campus_dates')
              .select('date, capacity, current_count')
              .eq('event_id', event.id)
              .eq('is_active', true)
              .order('date', { ascending: true });

            const { data: courses } = await supabaseAdmin
              .from('event_courses')
              .select('name, description')
              .eq('event_id', event.id)
              .order('display_order', { ascending: true });

            return { ...event, dates: dates || [], courses: courses || [] };
          })
        );

        eventPrompts = eventsWithDetails
          .map((event) => {
            let prompt = `\n【${event.name}】\n`;
            if (event.overview) prompt += `${event.overview}\n\n`;
            if (event.description) prompt += `補足情報: ${event.description}\n\n`;

            if (event.dates.length > 0) {
              prompt += '開催日程:\n';
              event.dates.forEach((date: { date: string; capacity: number; current_count: number }) => {
                const dateStr = new Date(date.date).toLocaleDateString('ja-JP', {
                  year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
                });
                const remaining = (date.capacity || 0) - (date.current_count || 0);
                prompt += `- ${dateStr}: 定員${date.capacity || 0}名（残り${remaining}名）\n`;
              });
              prompt += '\n';
            }

            if (event.courses.length > 0) {
              prompt += 'コース情報:\n';
              event.courses.forEach((course: { name: string; description: string }) => {
                prompt += `- ${course.name}${course.description ? ': ' + course.description : ''}\n`;
              });
            }
            return prompt;
          })
          .join('\n');
      }
    } catch (eventError) {
      console.error('Error fetching events for prompt:', eventError);
    }

    // 3. カスタム項目
    let customPrompts = '';
    try {
      const customItems = JSON.parse(settingsMap.prompt_custom_items || '[]');
      if (Array.isArray(customItems) && customItems.length > 0) {
        customPrompts = customItems
          .sort((a: { order: number }, b: { order: number }) => (a.order || 0) - (b.order || 0))
          .map((item: { name: string; content: string }) => `\n【${item.name || ''}】\n${item.content || ''}`)
          .join('\n');
      }
    } catch { /* ignore parse errors */ }

    // 3.5. 学科別情報
    let departmentPrompts = '';
    try {
      const departmentSections = JSON.parse(settingsMap.prompt_department_sections || '[]');
      if (Array.isArray(departmentSections) && departmentSections.length > 0) {
        const deptNames = departmentSections.map((d: { name: string }) => d.name).join('と');
        departmentPrompts = '\n【学科別情報 - 重要】\n';
        departmentPrompts += 'この学校には以下の学科があります。質問内容に応じて、該当する学科の情報を使って回答してください。\n\n';
        departmentPrompts += '重要なルール：\n';
        departmentPrompts += `- 質問内容からどの学科について聞いているか明確でない場合は、必ず「${deptNames}がございますが、どちらの学科についてのお問い合わせでしょうか？😊」と確認してから回答してください\n`;
        departmentPrompts += '- 学科を特定できる質問には、その学科の情報のみを使って回答してください\n';
        departmentPrompts += '- 両学科に共通する質問（アクセス、学校全体の情報など）はそのまま回答してください\n\n';

        departmentSections
          .sort((a: { order: number }, b: { order: number }) => (a.order || 0) - (b.order || 0))
          .forEach((dept: { name: string; keywords: string[]; content: string; additional_instructions?: string }) => {
            departmentPrompts += `＜${dept.name}＞\n`;
            if (Array.isArray(dept.keywords) && dept.keywords.length > 0) {
              departmentPrompts += `キーワード: ${dept.keywords.join('、')}\n`;
            }
            departmentPrompts += `${dept.content}\n`;
            if (dept.additional_instructions) {
              departmentPrompts += `追加指示: ${dept.additional_instructions}\n`;
            }
            departmentPrompts += '\n';
          });
      }
    } catch { /* ignore parse errors */ }

    // 4. 自動追記ルール
    let autoAppendPrompts = '';
    try {
      const autoAppendRules = JSON.parse(settingsMap.prompt_auto_append_rules || '[]');
      if (Array.isArray(autoAppendRules)) {
        const activeRules = autoAppendRules.filter((rule: { is_active: boolean }) => rule.is_active);
        if (activeRules.length > 0) {
          autoAppendPrompts = '\n【自動追記ルール - 重要】\n';
          autoAppendPrompts += '以下のキーワードを含む質問には、必ず指定のメッセージを回答に追加してください：\n\n';
          activeRules
            .sort((a: { order: number }, b: { order: number }) => (a.order || 0) - (b.order || 0))
            .forEach((rule: { keywords: string[]; position: string; message: string }) => {
              const keywords = Array.isArray(rule.keywords) ? rule.keywords.join('、') : '';
              const position = rule.position === 'start' ? '回答の最初' : '回答の最後';
              autoAppendPrompts += `・「${keywords}」のいずれかを含む質問の場合\n`;
              autoAppendPrompts += `  → ${position}に必ず以下を追加：\n`;
              autoAppendPrompts += `  ${rule.message}\n\n`;
            });
        }
      }
    } catch { /* ignore parse errors */ }

    // 5. 追加指示
    const additionalInstructions = settingsMap.prompt_additional_instructions || '';
    const additionalInstructionsPrompt = additionalInstructions.trim()
      ? `\n【追加指示】\n${additionalInstructions.trim()}\n`
      : '';

    // 5.5. 期間限定ルール
    let periodRulePrompts = '';
    try {
      const periodRules = JSON.parse(settingsMap.prompt_period_rules || '[]');
      if (Array.isArray(periodRules)) {
        const today = new Date().toISOString().split('T')[0];
        const activePeriodRules = periodRules.filter(
          (rule: { is_active: boolean; start_date: string; end_date: string }) =>
            rule.is_active && rule.start_date <= today && today <= rule.end_date
        );
        if (activePeriodRules.length > 0) {
          periodRulePrompts = '\n【期間限定のお知らせ - 重要】\n';
          periodRulePrompts += '以下の内容を、すべての回答の中で必ず案内してください：\n\n';
          activePeriodRules
            .sort((a: { order: number }, b: { order: number }) => (a.order || 0) - (b.order || 0))
            .forEach((rule: { name: string; message: string }) => {
              periodRulePrompts += `・${rule.name}: ${rule.message}\n`;
            });
          periodRulePrompts += '\n';
        }
      }
    } catch { /* ignore parse errors */ }

    // 6. 最終プロンプトを組み立て
    const finalPrompt = `あなたは学校の公式LINEアカウントのAIアシスタントです。
以下の情報に基づいて、正確かつ親切に回答してください。

【学校情報】
${settingsMap.prompt_school_info || '（未設定）'}

【アクセス】
${settingsMap.prompt_access || '（未設定）'}
${customPrompts}
${departmentPrompts}${eventPrompts ? '\n【開催予定のイベント】' + eventPrompts : ''}
${autoAppendPrompts}
${additionalInstructionsPrompt}
${periodRulePrompts}【回答ルール - 最重要】
- 上記の情報に含まれている内容のみを使って回答すること
- 上記の情報に含まれていない内容は、絶対に推測・創作・補足して回答しないこと
- 自分の一般知識やインターネット上の情報で補完しないこと
- 少しでも不確かな場合は、回答できない場合の対応に従うこと
- 常に丁寧で親しみやすい口調で話す
- 絵文字を適度に使用（1-2個/メッセージ）
- 長文は避け、簡潔に（200文字以内推奨）

【重要】回答できない場合の対応
上記の情報に含まれていない質問や、確実に回答できない内容については、以下のメッセージを一字一句そのまま正確に返してください。
内容を変更したり、言い換えたり、装飾したり、絵文字を追加したり、追加情報を加えたりしないでください：

${settingsMap.prompt_unable_response || '申し訳ございませんが、その質問にはお答えできません。'}

【すべての回答の最後に必ず追加する内容】
${settingsMap.prompt_closing_message || ''}`;

    promptCache.set(tenantId, { prompt: finalPrompt, cachedAt: now });
    return finalPrompt;
  } catch (error) {
    console.error('Error building system prompt:', error);
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
