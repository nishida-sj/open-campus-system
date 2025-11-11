import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// イベント詳細取得（日程とコース情報を含む）
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;

    // イベント情報を取得
    const { data: event, error: eventError } = await supabaseAdmin
      .from('open_campus_events')
      .select('*')
      .eq('id', eventId)
      .eq('is_active', true)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'イベントが見つかりません' },
        { status: 404 }
      );
    }

    // イベントに紐づく開催日程を取得
    const { data: dates, error: datesError } = await supabaseAdmin
      .from('open_campus_dates')
      .select('*')
      .eq('event_id', eventId)
      .eq('is_active', true)
      .order('date', { ascending: true });

    if (datesError) {
      console.error('日程取得エラー:', datesError);
      return NextResponse.json(
        { error: '日程の取得に失敗しました' },
        { status: 500 }
      );
    }

    // イベントに紐づくコースを取得
    const { data: courses, error: coursesError } = await supabaseAdmin
      .from('event_courses')
      .select('*')
      .eq('event_id', eventId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (coursesError) {
      console.error('コース取得エラー:', coursesError);
      return NextResponse.json(
        { error: 'コースの取得に失敗しました' },
        { status: 500 }
      );
    }

    // 各コースの適用日程を取得
    const coursesWithDates = await Promise.all(
      (courses || []).map(async (course) => {
        const { data: associations } = await supabaseAdmin
          .from('course_date_associations')
          .select('date_id')
          .eq('course_id', course.id);

        const applicableDateIds = (associations || []).map((a) => a.date_id);

        return {
          ...course,
          applicable_date_ids: applicableDateIds,
        };
      })
    );

    // 日程ごとに残席数を計算
    const datesWithRemaining = (dates || []).map((date) => ({
      ...date,
      remaining: Math.max(0, date.capacity - date.current_count),
    }));

    return NextResponse.json({
      event,
      dates: datesWithRemaining,
      courses: coursesWithDates,
    });
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
