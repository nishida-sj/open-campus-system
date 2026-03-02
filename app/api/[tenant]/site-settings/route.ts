import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getTenantBySlug } from '@/lib/tenant';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: slug } = await params;
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const { data: settings, error } = await supabaseAdmin
      .from('site_settings')
      .select('school_name, header_text, footer_text, primary_color')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // テナントのline_bot_basic_idを含める（公開情報）
    const lineBotBasicId = tenant.line_bot_basic_id || '';

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({
        school_name: tenant.display_name,
        header_text: tenant.display_name,
        footer_text: '',
        primary_color: '#1a365d',
        line_bot_basic_id: lineBotBasicId,
      });
    }

    return NextResponse.json({
      ...(settings || {
        school_name: tenant.display_name,
        header_text: tenant.display_name,
        footer_text: '',
        primary_color: '#1a365d',
      }),
      line_bot_basic_id: lineBotBasicId,
    });
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({
      school_name: 'オープンキャンパス',
      header_text: 'オープンキャンパス',
      footer_text: '',
      primary_color: '#1a365d',
    });
  }
}
