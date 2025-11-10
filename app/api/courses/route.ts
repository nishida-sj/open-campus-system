import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    // coursesテーブルから有効なコース（is_active=true）を取得
    // display_order順にソート
    const { data: courses, error } = await supabaseAdmin
      .from('courses')
      .select('id, name, category, description, display_order')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'コース一覧の取得に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json(courses || []);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
