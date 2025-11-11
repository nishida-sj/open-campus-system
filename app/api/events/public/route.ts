import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// 公開イベント一覧取得
export async function GET() {
  try {
    // 現在の日付を取得（日本時間）
    const today = new Date().toISOString().split('T')[0];

    // 公開中のイベントを取得
    const { data: events, error } = await supabaseAdmin
      .from('open_campus_events')
      .select(`
        id,
        name,
        description,
        overview,
        display_end_date,
        is_active,
        allow_multiple_dates,
        max_date_selections,
        created_at
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('イベント取得エラー:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // display_end_dateでフィルタリング（終了日が設定されていないか、まだ過ぎていないイベントのみ）
    const activeEvents = (events || []).filter(event => {
      if (!event.display_end_date) {
        return true; // 終了日が設定されていない場合は表示
      }
      return event.display_end_date >= today; // 終了日が今日以降の場合は表示
    });

    // 各イベントの開催日程を取得
    const eventsWithDates = await Promise.all(
      activeEvents.map(async (event) => {
        const { data: dates } = await supabaseAdmin
          .from('open_campus_dates')
          .select('id, date')
          .eq('event_id', event.id)
          .eq('is_active', true)
          .order('date', { ascending: true });

        return {
          ...event,
          dates: dates || [],
        };
      })
    );

    return NextResponse.json(eventsWithDates);
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
