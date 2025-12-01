/**
 * AI応答ロジック
 * OpenAI GPT-3.5 Turbo との統合
 */

import OpenAI from 'openai';
import { schoolKnowledge, emergencyContact, isApplicationRelated, isUrgentQuestion } from './school-knowledge';
import { checkUsageLimit, logUsage, getAISetting } from './usage-monitor';

// OpenAI Client初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

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

    // 2. システムプロンプト取得（DBから）
    const customPrompt = await getAISetting('system_prompt');
    const systemPrompt =
      customPrompt ||
      `あなたは学校の公式LINEアカウントのAIアシスタントです。

以下の学校情報に基づいて、正確かつ親切に回答してください：

${schoolKnowledge}

【応答ルール】
1. 常に丁寧で親しみやすい口調で話す
2. 絵文字を適度に使用（1-2個/メッセージ）
3. 長文は避け、簡潔に（200文字以内推奨）
4. 不確かな情報は提供しない
5. 質問の意図を理解して適切に回答

【対応できない質問への回答】
- 個人情報の変更 → 電話でお問い合わせいただくよう案内
- 複雑な相談 → 個別相談会の予約を提案
- 学校情報以外の質問 → 「学校に関する質問にお答えできます」

【緊急時の連絡先】
電話: ${emergencyContact.phone}
受付: ${emergencyContact.hours}
メール: ${emergencyContact.email}`;

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
