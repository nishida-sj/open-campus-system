/**
 * テナント解決ロジック
 * URLのslugからテナント情報を取得
 */

import { supabaseAdmin } from './supabase';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  display_name: string;
  line_channel_access_token: string | null;
  line_channel_secret: string | null;
  line_bot_basic_id: string | null;
  openai_api_key: string | null;
  is_active: boolean;
}

// テナントキャッシュ（5分間有効）
const tenantCache = new Map<string, { tenant: Tenant; cachedAt: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5分

/**
 * slugからテナントを取得（キャッシュ付き）
 */
export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  try {
    // キャッシュチェック
    const cached = tenantCache.get(slug);
    if (cached && Date.now() - cached.cachedAt < CACHE_DURATION) {
      return cached.tenant;
    }

    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('id, slug, name, display_name, line_channel_access_token, line_channel_secret, line_bot_basic_id, openai_api_key, is_active')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    const tenant = data as Tenant;

    // キャッシュに保存
    tenantCache.set(slug, { tenant, cachedAt: Date.now() });

    return tenant;
  } catch (error) {
    console.error(`[Tenant] Error fetching tenant by slug '${slug}':`, error);
    return null;
  }
}

/**
 * テナントIDからテナントを取得
 */
export async function getTenantById(id: string): Promise<Tenant | null> {
  try {
    // キャッシュからIDで検索
    for (const cached of tenantCache.values()) {
      if (cached.tenant.id === id && Date.now() - cached.cachedAt < CACHE_DURATION) {
        return cached.tenant;
      }
    }

    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('id, slug, name, display_name, line_channel_access_token, line_channel_secret, line_bot_basic_id, openai_api_key, is_active')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    const tenant = data as Tenant;
    tenantCache.set(tenant.slug, { tenant, cachedAt: Date.now() });
    return tenant;
  } catch (error) {
    console.error(`[Tenant] Error fetching tenant by id '${id}':`, error);
    return null;
  }
}

/**
 * 全アクティブテナントを取得（LINE webhook用）
 */
export async function getAllActiveTenants(): Promise<Tenant[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('id, slug, name, display_name, line_channel_access_token, line_channel_secret, line_bot_basic_id, openai_api_key, is_active')
      .eq('is_active', true);

    if (error || !data) {
      return [];
    }

    // キャッシュ更新
    for (const tenant of data) {
      tenantCache.set(tenant.slug, { tenant: tenant as Tenant, cachedAt: Date.now() });
    }

    return data as Tenant[];
  } catch (error) {
    console.error('[Tenant] Error fetching all active tenants:', error);
    return [];
  }
}

/**
 * テナントキャッシュをクリア
 */
export function clearTenantCache(): void {
  tenantCache.clear();
}
