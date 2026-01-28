import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// サイト設定取得
export async function GET() {
  try {
    const { data: settings, error } = await supabaseAdmin
      .from('site_settings')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('設定取得エラー:', error);
      return NextResponse.json({ error: '設定の取得に失敗しました' }, { status: 500 });
    }

    return NextResponse.json(settings || {
      school_name: 'オープンキャンパス',
      header_text: 'オープンキャンパス',
      footer_text: '',
      primary_color: '#1a365d',
    });
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// サイト設定更新
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { school_name, header_text, footer_text, primary_color } = body;

    if (!school_name) {
      return NextResponse.json(
        { error: '学校名は必須です' },
        { status: 400 }
      );
    }

    // 既存の設定をすべて無効化
    await supabaseAdmin
      .from('site_settings')
      .update({ is_active: false })
      .eq('is_active', true);

    // 新しい設定を作成
    const { data: newSettings, error: insertError } = await supabaseAdmin
      .from('site_settings')
      .insert({
        school_name,
        header_text: header_text || school_name + ' オープンキャンパス',
        footer_text: footer_text || '© ' + school_name,
        primary_color: primary_color || '#1a365d',
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('設定保存エラー:', insertError);
      return NextResponse.json(
        {
          error: '設定の保存に失敗しました',
          details: insertError.message,
          hint: 'Supabaseで docs/database_site_settings.sql を実行してテーブルを作成してください',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(newSettings);
  } catch (error: any) {
    console.error('サーバーエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラー', details: error.message },
      { status: 500 }
    );
  }
}
