import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// イベント一覧取得
export async function GET() {
  try {
    const { data: events, error } = await supabaseAdmin
      .from('open_campus_events')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('イベント取得エラー:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(events || []);
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// イベント作成
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, overview, display_end_date, max_date_selections, is_active, allow_multiple_dates, dates, courses } = body;

    // バリデーション
    if (!name || !dates || dates.length === 0) {
      return NextResponse.json(
        { error: 'イベント名と開催日程を入力してください' },
        { status: 400 }
      );
    }

    // 日程データのバリデーション
    for (const date of dates) {
      if (!date.date || !date.capacity || date.capacity < 1) {
        return NextResponse.json(
          { error: '開催日と定員を正しく入力してください' },
          { status: 400 }
        );
      }
    }

    // コースのバリデーション
    if (courses && courses.length > 0) {
      for (const course of courses) {
        if (!course.name || !course.name.trim()) {
          return NextResponse.json(
            { error: 'コース名を入力してください' },
            { status: 400 }
          );
        }
        if (!course.applicable_date_indices || course.applicable_date_indices.length === 0) {
          return NextResponse.json(
            { error: `コース「${course.name}」に適用する日程を選択してください` },
            { status: 400 }
          );
        }
      }
    }

    // イベント作成
    const { data: event, error: eventError } = await supabaseAdmin
      .from('open_campus_events')
      .insert({
        name,
        description: description || null,
        overview: overview || null,
        display_end_date: display_end_date || null,
        max_date_selections: max_date_selections || 1,
        is_active: is_active !== undefined ? is_active : true,
        allow_multiple_dates: allow_multiple_dates || false,
      })
      .select()
      .single();

    if (eventError) {
      console.error('イベント作成エラー:', eventError);
      return NextResponse.json({ error: eventError.message }, { status: 500 });
    }

    // 開催日程を作成
    const datesToInsert = dates.map((d: { date: string; capacity: number }) => ({
      event_id: event.id,
      date: d.date,
      capacity: d.capacity,
      current_count: 0,
      is_active: true,
    }));

    const { data: insertedDates, error: datesError } = await supabaseAdmin
      .from('open_campus_dates')
      .insert(datesToInsert)
      .select();

    if (datesError) {
      console.error('日程作成エラー:', datesError);
      // イベントは作成されたが日程作成に失敗した場合、イベントを削除
      await supabaseAdmin.from('open_campus_events').delete().eq('id', event.id);
      return NextResponse.json({ error: '開催日程の作成に失敗しました' }, { status: 500 });
    }

    // コースを作成（コースが登録されている場合）
    if (courses && courses.length > 0 && insertedDates) {
      const coursesToInsert = courses.map((c: any, index: number) => ({
        event_id: event.id,
        name: c.name,
        description: c.description || null,
        capacity: c.capacity,
        display_order: index,
        is_active: true,
      }));

      const { data: insertedCourses, error: coursesError } = await supabaseAdmin
        .from('event_courses')
        .insert(coursesToInsert)
        .select();

      if (coursesError) {
        console.error('コース作成エラー:', coursesError);
        // ロールバック
        await supabaseAdmin.from('open_campus_events').delete().eq('id', event.id);
        return NextResponse.json({ error: 'コースの作成に失敗しました' }, { status: 500 });
      }

      // コースと日程の関連付けを作成
      if (insertedCourses) {
        const associations: any[] = [];
        courses.forEach((course: any, courseIndex: number) => {
          course.applicable_date_indices.forEach((dateIndex: number) => {
            if (dateIndex < insertedDates.length) {
              associations.push({
                course_id: insertedCourses[courseIndex].id,
                date_id: insertedDates[dateIndex].id,
              });
            }
          });
        });

        if (associations.length > 0) {
          const { error: associationsError } = await supabaseAdmin
            .from('course_date_associations')
            .insert(associations);

          if (associationsError) {
            console.error('コース日程関連付けエラー:', associationsError);
            // ロールバック
            await supabaseAdmin.from('open_campus_events').delete().eq('id', event.id);
            return NextResponse.json(
              { error: 'コースと日程の関連付けに失敗しました' },
              { status: 500 }
            );
          }
        }
      }
    }

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
