import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// 公開イベント一覧取得
export async function GET() {
  try {
    // 公開中のイベントを取得
    const { data: events, error } = await supabaseAdmin
      .from('open_campus_events')
      .select(`
        id,
        name,
        description,
        overview,
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

    // 各イベントの日程数を取得
    const eventsWithCounts = await Promise.all(
      (events || []).map(async (event) => {
        const { count } = await supabaseAdmin
          .from('open_campus_dates')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', event.id)
          .eq('is_active', true);

        return {
          ...event,
          date_count: count || 0,
        };
      })
    );

    return NextResponse.json(eventsWithCounts);
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
