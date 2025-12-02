/**
 * AI応答ロジック
 * OpenAI GPT-3.5 Turbo との統合
 */

import OpenAI from 'openai';
import { emergencyContact, isApplicationRelated, isUrgentQuestion } from './school-knowledge';
import { checkUsageLimit, logUsage, getAISetting } from './usage-monitor';

// プロンプトキャッシュ（5分間有効）
let cachedPrompt: string | null = null;
let promptCacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5分

// OpenAI Client初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * 動的プロンプトをAPIから取得（キャッシュ付き）
 */
async function fetchSystemPrompt(): Promise<string> {
  try {
    // キャッシュが有効な場合はキャッシュを返す
    const now = Date.now();
    if (cachedPrompt && now - promptCacheTime < CACHE_DURATION) {
      console.log('Using cached prompt');
      return cachedPrompt;
    }

    // APIからプロンプトを取得
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/admin/ai-prompt`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch prompt: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.prompt) {
      throw new Error('Invalid prompt response');
    }

    // キャッシュを更新
    cachedPrompt = data.prompt;
    promptCacheTime = now;
    console.log('Prompt fetched and cached successfully');

    return data.prompt;
  } catch (error) {
    console.error('Error fetching system prompt:', error);
    // フォールバックとして基本的なプロンプトを返す
    return `あなたは学校の公式LINEアカウントのAIアシスタントです。
以下のルールに従って回答してください：

【回答ルール】
- 常に丁寧で親しみやすい口調で話す
- 絵文字を適度に使用（1-2個/メッセージ）
- 長文は避け、簡潔に（200文字以内推奨）
- 不確かな情報は提供しない
- 質問の意図を理解して適切に回答

【回答できない場合】
申し訳ございませんが、その質問にはお答えできません。
お電話でお問い合わせください。

📞 ${emergencyContact.phone}
⏰ ${emergencyContact.hours}`;
  }
}

export interface AIResponseResult {
  success: boolean;
  response?: string;
  error?: string;
  usageLimited?: boolean;
}

/**
 * AI応答を生成（使用量制限対応版）
 * @param lineUserId LINE User ID
 * @param userMessage ユーザーからのメッセージ
 * @param conversationHistory 会話履歴（オプション）
 * @returns AI応答結果
 */
export async function generateAIResponse(
  lineUserId: string,
  userMessage: string,
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[]
): Promise<AIResponseResult> {
  try {
    // 1. 使用量制限チェック
    const limitCheck = await checkUsageLimit();

    if (!limitCheck.allowed) {
      return {
        success: false,
        error: limitCheck.reason || '使用量制限に達しました',
        usageLimited: true,
      };
    }

    // 2. システムプロンプトを動的に取得（キャッシュ付き）
    const systemPrompt = await fetchSystemPrompt();

    // 3. メッセージ構築
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    // 会話履歴を追加（最新10件のみ）
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-10);
      messages.push(
        ...recentHistory.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }))
      );
    }

    // 現在のユーザーメッセージを追加
    messages.push({ role: 'user', content: userMessage });

    // 4. パラメータ取得
    const temperature = parseFloat((await getAISetting('temperature')) || '0.7');
    const maxTokens = parseInt((await getAISetting('max_tokens')) || '500');

    // 5. OpenAI API呼び出し
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // GPT-4o-mini を使用（高性能・低コスト）
      messages: messages,
      temperature: temperature,
      max_tokens: maxTokens,
      // データ学習について:
      // OpenAI APIは2023年3月1日以降、デフォルトでAPIデータを学習に使用しません
      // https://openai.com/policies/api-data-usage-policies
    });

    const response = completion.choices[0].message.content;
    const usage = completion.usage;

    if (!response || !usage) {
      throw new Error('Invalid API response');
    }

    // 6. 使用量をログ記録
    await logUsage(
      lineUserId,
      usage.prompt_tokens,
      usage.completion_tokens,
      usage.total_tokens,
      true
    );

    return {
      success: true,
      response,
    };
  } catch (error) {
    console.error('OpenAI API error:', error);

    // エラーもログに記録
    await logUsage(lineUserId, 0, 0, 0, false, error instanceof Error ? error.message : 'Unknown error');

    // エラーの種類に応じた応答
    if (error instanceof Error) {
      if (error.message.includes('rate_limit')) {
        return {
          success: false,
          error:
            'ただいま多くのお問い合わせをいただいており、少々お時間をいただいております。しばらくしてからもう一度お試しください🙇',
        };
      } else if (error.message.includes('api_key') || error.message.includes('Incorrect API key')) {
        console.error('OpenAI API key error');
        return {
          success: false,
          error: getDefaultErrorMessage(),
        };
      }
    }

    return {
      success: false,
      error: getDefaultErrorMessage(),
    };
  }
}

/**
 * プロンプトキャッシュをクリア（テスト用・設定更新後に使用）
 */
export function clearPromptCache(): void {
  cachedPrompt = null;
  promptCacheTime = 0;
  console.log('Prompt cache cleared');
}

/**
 * よくある質問かどうか判定
 */
export function isFrequentQuestion(message: string): boolean {
  const keywords = [
    'アクセス',
    '場所',
    '行き方',
    '日程',
    'いつ',
    '時間',
    '学費',
    '費用',
    '入試',
    '試験',
    'コース',
    '学科',
  ];

  return keywords.some((keyword) => message.includes(keyword));
}

/**
 * デフォルトエラーメッセージ
 */
function getDefaultErrorMessage(): string {
  return `申し訳ございません。一時的にシステムエラーが発生しております。

お急ぎの場合は、お電話でお問い合わせください。
📞 ${emergencyContact.phone}
⏰ ${emergencyContact.hours}`;
}

/**
 * トークン使用量の概算計算
 * @param text テキスト
 * @returns 推定トークン数
 */
export function estimateTokens(text: string): number {
  // 日本語の場合、おおよそ1文字=2トークン
  // 英語の場合、おおよそ1単語=1.3トークン
  return Math.ceil(text.length * 2);
}

// 便利な判定関数をエクスポート
export { isApplicationRelated, isUrgentQuestion };
