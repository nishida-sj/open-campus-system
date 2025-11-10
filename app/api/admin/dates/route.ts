import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    // open_campus_datesテーブルから全レコードを取得
    // date順（昇順）でソート
    const { data: dates, error } = await supabaseAdmin
      .from('open_campus_dates')
      .select('id, date, capacity, current_count, is_active')
      .order('date', { ascending: true });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: '開催日程一覧の取得に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json(dates || []);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
