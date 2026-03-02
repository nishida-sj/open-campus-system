/**
 * AI使用量監視ライブラリ（テナント対応）
 * GPT-4o-mini の使用量を追跡し、月間上限を管理
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
  maintenanceMode?: boolean;
}

export interface MaintenanceModeStatus {
  enabled: boolean;
  testerIds: string[];
}

/**
 * 今月の使用量を取得
 */
export async function getMonthlyUsage(tenantId: string): Promise<MonthlyUsage> {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: logs, error: logsError } = await supabaseAdmin
      .from('ai_usage_logs')
      .select('cost_usd, cost_jpy')
      .eq('tenant_id', tenantId)
      .gte('request_timestamp', startOfMonth.toISOString());

    if (logsError) {
      console.error('Error fetching usage logs:', logsError);
    }

    const totalCostUSD = logs?.reduce((sum, log) => sum + parseFloat(log.cost_usd), 0) || 0;
    const totalCostJPY = logs?.reduce((sum, log) => sum + parseFloat(log.cost_jpy), 0) || 0;
    const requestCount = logs?.length || 0;

    const { data: limitSetting, error: limitError } = await supabaseAdmin
      .from('ai_settings')
      .select('setting_value')
      .eq('tenant_id', tenantId)
      .eq('setting_key', 'monthly_limit_jpy')
      .single();

    if (limitError) {
      console.error('Error fetching limit setting:', limitError);
    }

    const limitJPY = parseFloat(limitSetting?.setting_value || '500');
    const remainingJPY = Math.max(0, limitJPY - totalCostJPY);
    const percentageUsed = limitJPY > 0 ? (totalCostJPY / limitJPY) * 100 : 0;

    return { totalCostUSD, totalCostJPY, requestCount, limitJPY, remainingJPY, percentageUsed };
  } catch (error) {
    console.error('Error in getMonthlyUsage:', error);
    return { totalCostUSD: 0, totalCostJPY: 0, requestCount: 0, limitJPY: 500, remainingJPY: 500, percentageUsed: 0 };
  }
}

/**
 * メンテナンスモードの状態を取得
 */
export async function getMaintenanceStatus(tenantId: string): Promise<MaintenanceModeStatus> {
  try {
    const { data: modeSetting } = await supabaseAdmin
      .from('ai_settings')
      .select('setting_value')
      .eq('tenant_id', tenantId)
      .eq('setting_key', 'maintenance_mode')
      .single();

    const enabled = modeSetting?.setting_value === 'true';

    const { data: testerSetting } = await supabaseAdmin
      .from('ai_settings')
      .select('setting_value')
      .eq('tenant_id', tenantId)
      .eq('setting_key', 'maintenance_tester_ids')
      .single();

    let testerIds: string[] = [];
    try {
      testerIds = JSON.parse(testerSetting?.setting_value || '[]');
    } catch {
      testerIds = [];
    }

    return { enabled, testerIds };
  } catch (error) {
    console.error('Error in getMaintenanceStatus:', error);
    return { enabled: false, testerIds: [] };
  }
}

/**
 * メンテナンスモード中にユーザーがAI機能を使用できるかチェック
 */
export async function canUseAIInMaintenanceMode(tenantId: string, lineUserId: string): Promise<{
  allowed: boolean;
  maintenanceMode: boolean;
  isTester: boolean;
}> {
  const status = await getMaintenanceStatus(tenantId);

  if (!status.enabled) {
    return { allowed: true, maintenanceMode: false, isTester: false };
  }

  const isTester = status.testerIds.includes(lineUserId);
  return { allowed: isTester, maintenanceMode: true, isTester };
}

/**
 * 使用量制限チェック
 */
export async function checkUsageLimit(tenantId: string): Promise<UsageLimitCheck> {
  try {
    const { data: enabledSetting, error: enabledError } = await supabaseAdmin
      .from('ai_settings')
      .select('setting_value')
      .eq('tenant_id', tenantId)
      .eq('setting_key', 'enabled')
      .single();

    if (enabledError) {
      console.error('Error fetching enabled setting:', enabledError);
    }

    if (enabledSetting?.setting_value !== 'true') {
      return { allowed: false, reason: 'AI機能が無効化されています', usage: null };
    }

    const usage = await getMonthlyUsage(tenantId);

    if (usage.totalCostJPY >= usage.limitJPY) {
      return { allowed: false, reason: `月間使用量上限（¥${usage.limitJPY}）に達しました`, usage };
    }

    if (usage.percentageUsed >= 90) {
      console.warn(`⚠️ AI使用量が${usage.percentageUsed.toFixed(1)}%に達しています`);
    }

    return { allowed: true, usage };
  } catch (error) {
    console.error('Error in checkUsageLimit:', error);
    return { allowed: false, reason: '使用量チェック中にエラーが発生しました', usage: null };
  }
}

/**
 * 使用量をログ記録
 */
export async function logUsage(
  tenantId: string,
  lineUserId: string,
  promptTokens: number,
  completionTokens: number,
  totalTokens: number,
  success: boolean = true,
  errorMessage?: string
): Promise<void> {
  try {
    const costUSD =
      (promptTokens / 1000) * COST_PER_1K_INPUT +
      (completionTokens / 1000) * COST_PER_1K_OUTPUT;

    const { data: rateSetting, error: rateError } = await supabaseAdmin
      .from('ai_settings')
      .select('setting_value')
      .eq('tenant_id', tenantId)
      .eq('setting_key', 'usd_to_jpy_rate')
      .single();

    if (rateError) {
      console.error('Error fetching USD/JPY rate:', rateError);
    }

    const usdToJpyRate = parseFloat(rateSetting?.setting_value || '150');
    const costJPY = costUSD * usdToJpyRate;

    const { error: insertError } = await supabaseAdmin.from('ai_usage_logs').insert({
      tenant_id: tenantId,
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

    const usage = await getMonthlyUsage(tenantId);

    if (usage.percentageUsed >= 95) {
      console.error('🚨 使用量が95%に達したため、AI機能を自動無効化しました');

      await supabaseAdmin
        .from('ai_settings')
        .update({ setting_value: 'false' })
        .eq('tenant_id', tenantId)
        .eq('setting_key', 'enabled');
    }
  } catch (error) {
    console.error('Error in logUsage:', error);
  }
}

/**
 * AI設定を取得
 */
export async function getAISetting(tenantId: string, key: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('ai_settings')
      .select('setting_value')
      .eq('tenant_id', tenantId)
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
 */
export async function updateAISetting(tenantId: string, key: string, value: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('ai_settings')
      .update({ setting_value: value, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
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

// ========================================
// テスター招待コード関連
// ========================================

/**
 * テスター招待コードを生成
 */
export async function generateTesterInviteCode(expiresInMinutes: number = 10, tenantId: string): Promise<string | null> {
  try {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

    const { error: codeError } = await supabaseAdmin
      .from('ai_settings')
      .upsert({ tenant_id: tenantId, setting_key: 'maintenance_invite_code', setting_value: code, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id,setting_key' });

    const { error: expiresError } = await supabaseAdmin
      .from('ai_settings')
      .upsert({ tenant_id: tenantId, setting_key: 'maintenance_invite_expires', setting_value: expiresAt, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id,setting_key' });

    if (codeError || expiresError) {
      console.error('Error saving invite code:', codeError || expiresError);
      return null;
    }

    return code;
  } catch (error) {
    console.error('Error in generateTesterInviteCode:', error);
    return null;
  }
}

/**
 * テスター招待コードを検証し、有効ならテスターリストに追加
 */
export async function verifyAndAddTester(tenantId: string, code: string, lineUserId: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const { data: codeSetting } = await supabaseAdmin
      .from('ai_settings')
      .select('setting_value')
      .eq('tenant_id', tenantId)
      .eq('setting_key', 'maintenance_invite_code')
      .single();

    const { data: expiresSetting } = await supabaseAdmin
      .from('ai_settings')
      .select('setting_value')
      .eq('tenant_id', tenantId)
      .eq('setting_key', 'maintenance_invite_expires')
      .single();

    const savedCode = codeSetting?.setting_value;
    const expiresAt = expiresSetting?.setting_value;

    if (!savedCode || savedCode === '') {
      return { success: false, message: '招待コードが発行されていません' };
    }

    if (savedCode.toUpperCase() !== code.toUpperCase()) {
      return { success: false, message: '招待コードが正しくありません' };
    }

    if (expiresAt && new Date(expiresAt) < new Date()) {
      return { success: false, message: '招待コードの有効期限が切れています' };
    }

    const { data: testerSetting } = await supabaseAdmin
      .from('ai_settings')
      .select('setting_value')
      .eq('tenant_id', tenantId)
      .eq('setting_key', 'maintenance_tester_ids')
      .single();

    let testerIds: string[] = [];
    try {
      testerIds = JSON.parse(testerSetting?.setting_value || '[]');
    } catch {
      testerIds = [];
    }

    if (testerIds.includes(lineUserId)) {
      return { success: true, message: '既にテスターとして登録されています' };
    }

    testerIds.push(lineUserId);
    const { error: updateError } = await supabaseAdmin
      .from('ai_settings')
      .upsert({
        tenant_id: tenantId,
        setting_key: 'maintenance_tester_ids',
        setting_value: JSON.stringify(testerIds),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,setting_key' });

    if (updateError) {
      console.error('Error updating tester list:', updateError);
      return { success: false, message: 'テスター登録に失敗しました' };
    }

    await supabaseAdmin
      .from('ai_settings')
      .update({ setting_value: '', updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('setting_key', 'maintenance_invite_code');

    return { success: true, message: 'テスターとして登録されました' };
  } catch (error) {
    console.error('Error in verifyAndAddTester:', error);
    return { success: false, message: 'エラーが発生しました' };
  }
}

/**
 * 現在の招待コード情報を取得
 */
export async function getInviteCodeInfo(tenantId: string): Promise<{
  code: string | null;
  expiresAt: string | null;
  isValid: boolean;
}> {
  try {
    const { data: codeSetting } = await supabaseAdmin
      .from('ai_settings')
      .select('setting_value')
      .eq('tenant_id', tenantId)
      .eq('setting_key', 'maintenance_invite_code')
      .single();

    const { data: expiresSetting } = await supabaseAdmin
      .from('ai_settings')
      .select('setting_value')
      .eq('tenant_id', tenantId)
      .eq('setting_key', 'maintenance_invite_expires')
      .single();

    const code = codeSetting?.setting_value || null;
    const expiresAt = expiresSetting?.setting_value || null;
    const isValid = !!(code && code !== '' && expiresAt && new Date(expiresAt) > new Date());

    return { code: code || null, expiresAt, isValid };
  } catch (error) {
    console.error('Error in getInviteCodeInfo:', error);
    return { code: null, expiresAt: null, isValid: false };
  }
}
