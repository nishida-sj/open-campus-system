import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// キャッシュを無効化（常に最新の設定を返す）
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// サイト設定取得（公開API）
export async function GET() {
  try {
    const { data: settings, error } = await supabaseAdmin
      .from('site_settings')
      .select('school_name, header_text, footer_text, primary_color')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('設定取得エラー:', error);
      // エラー時はデフォルト値を返す
      return NextResponse.json({
        school_name: 'オープンキャンパス',
        header_text: 'オープンキャンパス',
        footer_text: '',
        primary_color: '#1a365d',
      });
    }

    return NextResponse.json(settings || {
      school_name: 'オープンキャンパス',
      header_text: 'オープンキャンパス',
      footer_text: '',
      primary_color: '#1a365d',
    });
  } catch (error) {
    console.error('サーバーエラー:', error);
    // エラー時はデフォルト値を返す
    return NextResponse.json({
      school_name: 'オープンキャンパス',
      header_text: 'オープンキャンパス',
      footer_text: '',
      primary_color: '#1a365d',
    });
  }
}
