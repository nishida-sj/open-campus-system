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

    // 各イベントの申込者数をカウント
    const eventsWithApplicants = await Promise.all(
      (events || []).map(async (event) => {
        // イベントの日程IDを取得
        const { data: dates } = await supabaseAdmin
          .from('open_campus_dates')
          .select('id')
          .eq('event_id', event.id);

        const dateIds = (dates || []).map(d => d.id);

        // 申込者数をカウント
        const { count } = await supabaseAdmin
          .from('applicant_visit_dates')
          .select('applicant_id', { count: 'exact', head: true })
          .in('visit_date_id', dateIds);

        return {
          ...event,
          total_applicants: count || 0,
        };
      })
    );

    return NextResponse.json(eventsWithApplicants);
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// イベント作成
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, overview, confirmation_message, display_end_date, max_date_selections, is_active, allow_multiple_dates, allow_multiple_candidates, dates, courses } = body;

    // バリデーション
    if (!name || !dates || dates.length === 0) {
      return NextResponse.json(
        { error: 'イベント名と開催日程を入力してください' },
        { status: 400 }
      );
    }

    // allow_multiple_datesとallow_multiple_candidatesの排他チェック
    if (allow_multiple_dates && allow_multiple_candidates) {
      return NextResponse.json(
        { error: '複数日参加と複数候補入力は同時に許可できません' },
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
        confirmation_message: confirmation_message || null,
        display_end_date: display_end_date || null,
        max_date_selections: max_date_selections || 1,
        is_active: is_active !== undefined ? is_active : true,
        allow_multiple_dates: allow_multiple_dates || false,
        allow_multiple_candidates: allow_multiple_candidates || false,
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

      // コースと日程の関連付けとコース×日程別定員を作成
      if (insertedCourses) {
        const associations: any[] = [];
        const capacities: any[] = [];

        courses.forEach((course: any, courseIndex: number) => {
          course.applicable_date_indices.forEach((dateIndex: number) => {
            if (dateIndex < insertedDates.length) {
              const courseId = insertedCourses[courseIndex].id;
              const dateId = insertedDates[dateIndex].id;

              associations.push({
                course_id: courseId,
                date_id: dateId,
              });

              // コース×日程別定員レコードを作成
              // date_capacitiesから該当日程の定員を取得
              const dateCapacity = course.date_capacities?.[dateIndex] || course.capacity || 0;
              capacities.push({
                course_id: courseId,
                date_id: dateId,
                capacity: dateCapacity,
                current_count: 0,
              });
            }
          });
        });

        // 関連付けテーブルに挿入
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

        // コース×日程別定員テーブルに挿入
        if (capacities.length > 0) {
          const { error: capacitiesError } = await supabaseAdmin
            .from('course_date_capacities')
            .insert(capacities);

          if (capacitiesError) {
            console.error('コース定員登録エラー:', capacitiesError);
            // ロールバック
            await supabaseAdmin.from('open_campus_events').delete().eq('id', event.id);
            return NextResponse.json(
              { error: 'コース定員の登録に失敗しました' },
              { status: 500 }
            );
          }
        }

        // 日程の合計定員を更新
        for (const date of insertedDates) {
          const dateCourseCapacities = capacities.filter(c => c.date_id === date.id);
          const totalCapacity = dateCourseCapacities.reduce((sum, c) => sum + c.capacity, 0);

          await supabaseAdmin
            .from('open_campus_dates')
            .update({ capacity: totalCapacity })
            .eq('id', date.id);
        }
      }
    }

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
