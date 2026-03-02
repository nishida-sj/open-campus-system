import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getTenantBySlug, clearTenantCache } from '@/lib/tenant';
import { getCurrentUserFromRequest } from '@/lib/auth';

/**
 * テナント設定取得（SUPER_ADMINのみ）
 * 機密情報はマスク表示
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: slug } = await params;
    const tenant = await getTenantBySlug(slug);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // 権限チェック（SUPER_ADMIN = level 100）
    const user = await getCurrentUserFromRequest(tenant.id);
    if (!user || user.max_role_level < 100) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 });
    }

    // テナント情報を取得（全カラム）
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', tenant.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'テナント情報の取得に失敗しました' }, { status: 500 });
    }

    // 機密情報をマスク
    return NextResponse.json({
      id: data.id,
      slug: data.slug,
      name: data.name,
      display_name: data.display_name,
      is_active: data.is_active,
      // LINE設定（マスク表示）
      line_channel_access_token: maskSecret(data.line_channel_access_token),
      line_channel_secret: maskSecret(data.line_channel_secret),
      line_bot_basic_id: data.line_bot_basic_id || '',
      // OpenAI設定（マスク表示）
      openai_api_key: maskSecret(data.openai_api_key),
      // 設定状態フラグ
      has_line_config: !!(data.line_channel_access_token && data.line_channel_secret),
      has_openai_config: !!data.openai_api_key,
    });
  } catch (error) {
    console.error('テナント設定取得エラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

/**
 * テナント設定更新（SUPER_ADMINのみ）
 * 空文字のフィールドは更新しない（既存値を維持）
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: slug } = await params;
    const tenant = await getTenantBySlug(slug);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // 権限チェック（SUPER_ADMIN = level 100）
    const user = await getCurrentUserFromRequest(tenant.id);
    if (!user || user.max_role_level < 100) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      display_name,
      line_channel_access_token,
      line_channel_secret,
      line_bot_basic_id,
      openai_api_key,
    } = body;

    // 更新対象のフィールドを構築（空文字・undefinedは除外）
    const updates: Record<string, string> = {};

    if (name && name.trim()) updates.name = name.trim();
    if (display_name && display_name.trim()) updates.display_name = display_name.trim();

    // LINE設定（空でない値のみ更新。"CLEAR"で明示削除）
    if (line_channel_access_token === 'CLEAR') {
      updates.line_channel_access_token = '';
    } else if (line_channel_access_token && !line_channel_access_token.includes('***')) {
      updates.line_channel_access_token = line_channel_access_token.trim();
    }

    if (line_channel_secret === 'CLEAR') {
      updates.line_channel_secret = '';
    } else if (line_channel_secret && !line_channel_secret.includes('***')) {
      updates.line_channel_secret = line_channel_secret.trim();
    }

    if (line_bot_basic_id !== undefined) {
      updates.line_bot_basic_id = (line_bot_basic_id || '').trim();
    }

    // OpenAI設定
    if (openai_api_key === 'CLEAR') {
      updates.openai_api_key = '';
    } else if (openai_api_key && !openai_api_key.includes('***')) {
      updates.openai_api_key = openai_api_key.trim();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '更新する項目がありません' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('tenants')
      .update(updates)
      .eq('id', tenant.id);

    if (error) {
      console.error('テナント設定更新エラー:', error);
      return NextResponse.json({ error: '設定の更新に失敗しました' }, { status: 500 });
    }

    // キャッシュクリア（更新を即時反映）
    clearTenantCache();

    return NextResponse.json({
      success: true,
      message: 'テナント設定を更新しました',
      updated_fields: Object.keys(updates),
    });
  } catch (error) {
    console.error('テナント設定更新エラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

/**
 * 機密情報をマスク表示
 * 先頭4文字 + *** + 末尾4文字
 */
function maskSecret(value: string | null): string {
  if (!value) return '';
  if (value.length <= 8) return '***';
  return value.substring(0, 4) + '***' + value.substring(value.length - 4);
}
