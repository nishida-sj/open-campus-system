import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    // 今日の日付を取得（YYYY-MM-DD形式）
    const today = new Date().toISOString().split('T')[0];

    // open_campus_datesテーブルから開催日程を取得
    // 条件: is_active=true AND date >= 今日
    // date順にソート（昇順）
    const { data: dates, error } = await supabaseAdmin
      .from('open_campus_dates')
      .select('id, date, capacity, current_count, is_active')
      .eq('is_active', true)
      .gte('date', today)
      .order('date', { ascending: true });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: '開催日程の取得に失敗しました' },
        { status: 500 }
      );
    }

    // 残席数を計算して返す
    const datesWithRemaining = (dates || []).map(date => ({
      ...date,
      remaining: date.capacity - date.current_count
    }));

    return NextResponse.json(datesWithRemaining);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
