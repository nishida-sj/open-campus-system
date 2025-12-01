/**
 * AI使用量監視ライブラリ
 * GPT-3.5 Turbo の使用量を追跡し、月間上限を管理
 */

import { supabaseAdmin } from './supabase';

// GPT-4o-mini の料金（2024年11月時点）
const COST_PER_1K_INPUT = 0.00015;   // $0.150 / 1M tokens
const COST_PER_1K_OUTPUT = 0.0006;   // $0.600 / 1M tokens

export interface MonthlyUsage {
  totalCostUSD: number;
  totalCostJPY: number;
  requestCount: number;
  limitJPY: number;
  remainingJPY: number;
  percentageUsed: number;
}

export interface UsageLimitCheck {
  allowed: boolean;
  reason?: string;
  usage: MonthlyUsage | null;
}

/**
 * 今月の使用量を取得
 */
export async function getMonthlyUsage(): Promise<MonthlyUsage> {
  try {
    // 今月の開始日
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // 使用量を集計
    const { data: logs, error: logsError } = await supabaseAdmin
      .from('ai_usage_logs')
      .select('cost_usd, cost_jpy')
      .gte('request_timestamp', startOfMonth.toISOString());

    if (logsError) {
      console.error('Error fetching usage logs:', logsError);
    }

    const totalCostUSD = logs?.reduce((sum, log) => sum + parseFloat(log.cost_usd), 0) || 0;
    const totalCostJPY = logs?.reduce((sum, log) => sum + parseFloat(log.cost_jpy), 0) || 0;
    const requestCount = logs?.length || 0;

    // 月間上限を取得
    const { data: limitSetting, error: limitError } = await supabaseAdmin
      .from('ai_settings')
      .select('setting_value')
      .eq('setting_key', 'monthly_limit_jpy')
      .single();

    if (limitError) {
      console.error('Error fetching limit setting:', limitError);
    }

    const limitJPY = parseFloat(limitSetting?.setting_value || '500');
    const remainingJPY = Math.max(0, limitJPY - totalCostJPY);
    const percentageUsed = limitJPY > 0 ? (totalCostJPY / limitJPY) * 100 : 0;

    return {
      totalCostUSD,
      totalCostJPY,
      requestCount,
      limitJPY,
      remainingJPY,
      percentageUsed,
    };
  } catch (error) {
    console.error('Error in getMonthlyUsage:', error);
    // デフォルト値を返す
    return {
      totalCostUSD: 0,
      totalCostJPY: 0,
      requestCount: 0,
      limitJPY: 500,
      remainingJPY: 500,
      percentageUsed: 0,
    };
  }
}

/**
 * 使用量制限チェック
 * @returns allowed: true なら使用可能、false なら制限超過
 */
export async function checkUsageLimit(): Promise<UsageLimitCheck> {
  try {
    // AI機能の有効/無効チェック
    const { data: enabledSetting, error: enabledError } = await supabaseAdmin
      .from('ai_settings')
      .select('setting_value')
      .eq('setting_key', 'enabled')
      .single();

    if (enabledError) {
      console.error('Error fetching enabled setting:', enabledError);
    }

    if (enabledSetting?.setting_value !== 'true') {
      return {
        allowed: false,
        reason: 'AI機能が無効化されています',
        usage: null,
      };
    }

    // 使用量チェック
    const usage = await getMonthlyUsage();

    if (usage.totalCostJPY >= usage.limitJPY) {
      return {
        allowed: false,
        reason: `月間使用量上限（¥${usage.limitJPY}）に達しました`,
        usage,
      };
    }

    // 90%警告（ログのみ）
    if (usage.percentageUsed >= 90) {
      console.warn(`⚠️ AI使用量が${usage.percentageUsed.toFixed(1)}%に達しています`);
    }

    return {
      allowed: true,
      usage,
    };
  } catch (error) {
    console.error('Error in checkUsageLimit:', error);
    // エラー時は安全のため使用を許可しない
    return {
      allowed: false,
      reason: '使用量チェック中にエラーが発生しました',
      usage: null,
    };
  }
}

/**
 * 使用量をログ記録
 * @param lineUserId LINE User ID
 * @param promptTokens 入力トークン数
 * @param completionTokens 出力トークン数
 * @param totalTokens 合計トークン数
 * @param success API呼び出し成功フラグ
 * @param errorMessage エラーメッセージ（失敗時）
 */
export async function logUsage(
  lineUserId: string,
  promptTokens: number,
  completionTokens: number,
  totalTokens: number,
  success: boolean = true,
  errorMessage?: string
): Promise<void> {
  try {
    // コスト計算
    const costUSD =
      (promptTokens / 1000) * COST_PER_1K_INPUT +
      (completionTokens / 1000) * COST_PER_1K_OUTPUT;

    // 換算レート取得
    const { data: rateSetting, error: rateError } = await supabaseAdmin
      .from('ai_settings')
      .select('setting_value')
      .eq('setting_key', 'usd_to_jpy_rate')
      .single();

    if (rateError) {
      console.error('Error fetching USD/JPY rate:', rateError);
    }

    const usdToJpyRate = parseFloat(rateSetting?.setting_value || '150');
    const costJPY = costUSD * usdToJpyRate;

    // ログ記録
    const { error: insertError } = await supabaseAdmin.from('ai_usage_logs').insert({
      line_user_id: lineUserId,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      cost_usd: costUSD,
      cost_jpy: costJPY,
      success,
      error_message: errorMessage || null,
    });

    if (insertError) {
      console.error('Error logging usage:', insertError);
      return;
    }

    // 使用量チェック（次回のために）
    const usage = await getMonthlyUsage();

    // 95%到達で自動無効化（安全策）
    if (usage.percentageUsed >= 95) {
      console.error('🚨 使用量が95%に達したため、AI機能を自動無効化しました');

      await supabaseAdmin
        .from('ai_settings')
        .update({ setting_value: 'false' })
        .eq('setting_key', 'enabled');
    }
  } catch (error) {
    console.error('Error in logUsage:', error);
    // ログ記録失敗は致命的ではないので、エラーを投げない
  }
}

/**
 * AI設定を取得
 * @param key 設定キー
 * @returns 設定値（文字列）
 */
export async function getAISetting(key: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('ai_settings')
      .select('setting_value')
      .eq('setting_key', key)
      .single();

    if (error) {
      console.error(`Error fetching AI setting '${key}':`, error);
      return null;
    }

    return data?.setting_value || null;
  } catch (error) {
    console.error(`Error in getAISetting('${key}'):`, error);
    return null;
  }
}

/**
 * AI設定を更新
 * @param key 設定キー
 * @param value 設定値
 */
export async function updateAISetting(key: string, value: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('ai_settings')
      .update({
        setting_value: value,
        updated_at: new Date().toISOString(),
      })
      .eq('setting_key', key);

    if (error) {
      console.error(`Error updating AI setting '${key}':`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error in updateAISetting('${key}'):`, error);
    return false;
  }
}
