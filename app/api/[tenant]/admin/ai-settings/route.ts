/**
 * AI設定管理API（テナント対応版）
 * GET: 設定取得
 * POST: 設定更新
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { clearPromptCache } from '@/lib/ai-response';
import { getTenantBySlug } from '@/lib/tenant';

// GET: AI設定を取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: slug } = await params;
    const tenant = await getTenantBySlug(slug);
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('ai_settings')
      .select('setting_key, setting_value, description, updated_at')
      .eq('tenant_id', tenant.id)
      .order('setting_key');

    if (error) {
      console.error('Failed to fetch AI settings:', error);
      throw error;
    }

    // オブジェクト形式に変換
    const settings: Record<string, string> = {};
    data?.forEach((item) => {
      settings[item.setting_key] = item.setting_value;
    });

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('Error in GET /api/[tenant]/admin/ai-settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch settings',
      },
      { status: 500 }
    );
  }
}

// POST: AI設定を更新
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: slug } = await params;
    const tenant = await getTenantBySlug(slug);
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const settings = body.settings || body;

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
        },
        { status: 400 }
      );
    }

    // 各設定を更新（UPSERT: 存在しない場合は挿入、存在する場合は更新）
    const updatePromises = Object.entries(settings).map(([key, value]) => {
      return supabaseAdmin
        .from('ai_settings')
        .upsert(
          {
            tenant_id: tenant.id,
            setting_key: key,
            setting_value: String(value),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'tenant_id,setting_key',
          }
        );
    });

    const results = await Promise.all(updatePromises);

    // エラーチェック
    const errors = results.filter((result) => result.error);
    if (errors.length > 0) {
      console.error('Failed to update some settings:', errors);
      console.error('Error details:', errors.map((e) => e.error));
      throw new Error('Failed to update settings');
    }

    // プロンプトキャッシュをクリア（設定変更を即座に反映）
    clearPromptCache();
    console.log('AI prompt cache cleared after settings update');

    return NextResponse.json({
      success: true,
      message: '設定を更新しました',
    });
  } catch (error) {
    console.error('Error in POST /api/[tenant]/admin/ai-settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update settings',
      },
      { status: 500 }
    );
  }
}
