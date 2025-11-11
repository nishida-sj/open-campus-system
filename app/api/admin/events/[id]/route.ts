import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// イベント詳細取得（管理用）
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
      .order('date', { ascending: true });

    if (datesError) {
      console.error('日程取得エラー:', datesError);
      return NextResponse.json(
        { error: '日程の取得に失敗しました' },
        { status: 500 }
      );
    }

    // 各日程に申込者がいるかチェック
    const datesWithApplicants = await Promise.all(
      (dates || []).map(async (date) => {
        const { count } = await supabaseAdmin
          .from('applicant_visit_dates')
          .select('*', { count: 'exact', head: true })
          .eq('visit_date_id', date.id);

        return {
          ...date,
          has_applicants: (count || 0) > 0,
        };
      })
    );

    // イベントに紐づくコースを取得
    const { data: courses, error: coursesError } = await supabaseAdmin
      .from('event_courses')
      .select('*')
      .eq('event_id', eventId)
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

    return NextResponse.json({
      event,
      dates: datesWithApplicants,
      courses: coursesWithDates,
    });
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// イベント情報更新（概要情報のみ）
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const body = await request.json();
    const { name, description, overview, display_end_date, is_active } = body;

    // バリデーション
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'イベント名を入力してください' },
        { status: 400 }
      );
    }

    // イベントが存在するか確認
    const { data: existingEvent, error: checkError } = await supabaseAdmin
      .from('open_campus_events')
      .select('id')
      .eq('id', eventId)
      .single();

    if (checkError || !existingEvent) {
      return NextResponse.json(
        { error: 'イベントが見つかりません' },
        { status: 404 }
      );
    }

    // 概要情報のみ更新（日程、コース設定は変更不可）
    const { data: updatedEvent, error: updateError } = await supabaseAdmin
      .from('open_campus_events')
      .update({
        name,
        description: description || null,
        overview: overview || null,
        display_end_date: display_end_date || null,
        is_active: is_active !== undefined ? is_active : true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId)
      .select()
      .single();

    if (updateError) {
      console.error('更新エラー:', updateError);
      return NextResponse.json(
        { error: '更新に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedEvent);
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
