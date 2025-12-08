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

    // 各コースの適用日程と日程別定員を取得
    const coursesWithDates = await Promise.all(
      (courses || []).map(async (course) => {
        const { data: associations } = await supabaseAdmin
          .from('course_date_associations')
          .select('date_id')
          .eq('course_id', course.id);

        const applicableDateIds = (associations || []).map((a) => a.date_id);

        // コース×日程別定員を取得
        const { data: dateCapacities } = await supabaseAdmin
          .from('course_date_capacities')
          .select('date_id, capacity')
          .eq('course_id', course.id);

        // date_id → capacity のマップを作成
        const dateCapacitiesMap: { [dateId: string]: number | null } = {};
        (dateCapacities || []).forEach((dc) => {
          dateCapacitiesMap[dc.date_id] = dc.capacity;
        });

        return {
          ...course,
          applicable_date_ids: applicableDateIds,
          date_capacities: dateCapacitiesMap,
        };
      })
    );

    // イベント全体の申込者数をカウント
    const dateIds = (dates || []).map(d => d.id);
    const { count: totalApplicants } = await supabaseAdmin
      .from('applicant_visit_dates')
      .select('applicant_id', { count: 'exact', head: true })
      .in('visit_date_id', dateIds);

    return NextResponse.json({
      event,
      dates: datesWithApplicants,
      courses: coursesWithDates,
      total_applicants: totalApplicants || 0,
    });
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// イベント情報更新
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const body = await request.json();
    const { name, description, overview, confirmation_message, display_end_date, is_active, allow_multiple_dates, allow_multiple_candidates, max_date_selections, dates, courses } = body;

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

    // 申込者がいる場合は日程・コース変更不可チェック
    if (dates || courses) {
      const { data: existingDates } = await supabaseAdmin
        .from('open_campus_dates')
        .select('id')
        .eq('event_id', eventId);

      const dateIds = (existingDates || []).map(d => d.id);
      const { count: applicantCount } = await supabaseAdmin
        .from('applicant_visit_dates')
        .select('applicant_id', { count: 'exact', head: true })
        .in('visit_date_id', dateIds);

      if ((applicantCount || 0) > 0) {
        return NextResponse.json(
          { error: '申込者がいるイベントの日程・コースは変更できません' },
          { status: 400 }
        );
      }
    }

    // 申込者数を確認
    const { data: existingDatesForCount } = await supabaseAdmin
      .from('open_campus_dates')
      .select('id')
      .eq('event_id', eventId);

    const dateIdsForCount = (existingDatesForCount || []).map(d => d.id);
    const { count: totalApplicants } = await supabaseAdmin
      .from('applicant_visit_dates')
      .select('applicant_id', { count: 'exact', head: true })
      .in('visit_date_id', dateIdsForCount);

    // 申込者が0件の場合はallow_multiple_datesとmax_date_selectionsも更新可能
    const updateData: any = {
      name,
      description: description || null,
      overview: overview || null,
      confirmation_message: confirmation_message || null,
      display_end_date: display_end_date || null,
      is_active: is_active !== undefined ? is_active : true,
      updated_at: new Date().toISOString(),
    };

    // 申込者が0件の場合のみ、複数日設定を更新
    if ((totalApplicants || 0) === 0) {
      // allow_multiple_datesとallow_multiple_candidatesの排他チェック
      const newAllowMultipleDates = allow_multiple_dates !== undefined ? allow_multiple_dates : updateData.allow_multiple_dates;
      const newAllowMultipleCandidates = allow_multiple_candidates !== undefined ? allow_multiple_candidates : updateData.allow_multiple_candidates;

      if (newAllowMultipleDates && newAllowMultipleCandidates) {
        return NextResponse.json(
          { error: '複数日参加と複数候補入力は同時に許可できません' },
          { status: 400 }
        );
      }

      if (allow_multiple_dates !== undefined) {
        updateData.allow_multiple_dates = allow_multiple_dates;
      }
      if (allow_multiple_candidates !== undefined) {
        updateData.allow_multiple_candidates = allow_multiple_candidates;
      }
      if (max_date_selections !== undefined) {
        updateData.max_date_selections = max_date_selections;
      }
    }

    // イベント基本情報を更新
    const { data: updatedEvent, error: updateError } = await supabaseAdmin
      .from('open_campus_events')
      .update(updateData)
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

    // 日程とコースが含まれている場合は更新
    if (dates && courses) {
      try {
        // 既存の日程・コース・関連データを削除
        const { data: existingDates } = await supabaseAdmin
          .from('open_campus_dates')
          .select('id')
          .eq('event_id', eventId);

        const existingDateIds = (existingDates || []).map(d => d.id);

        // コースと日程の関連を削除
        const { data: existingCourses } = await supabaseAdmin
          .from('event_courses')
          .select('id')
          .eq('event_id', eventId);

        const existingCourseIds = (existingCourses || []).map(c => c.id);

        if (existingCourseIds.length > 0) {
          await supabaseAdmin
            .from('course_date_associations')
            .delete()
            .in('course_id', existingCourseIds);
        }

        // 既存のコースを削除
        await supabaseAdmin
          .from('event_courses')
          .delete()
          .eq('event_id', eventId);

        // 既存の日程を削除
        await supabaseAdmin
          .from('open_campus_dates')
          .delete()
          .eq('event_id', eventId);

        // 新しい日程を作成
        const createdDates: Array<{ id: string; date: string; capacity: number }> = [];
        for (const date of dates) {
          const { data: newDate, error: dateError } = await supabaseAdmin
            .from('open_campus_dates')
            .insert({
              event_id: eventId,
              date: date.date,
              capacity: date.capacity,
              current_count: 0,
              is_active: true,
            })
            .select()
            .single();

          if (dateError) {
            console.error('日程作成エラー:', dateError);
            throw new Error('日程の作成に失敗しました');
          }

          createdDates.push(newDate);
        }

        // 新しいコースを作成
        for (const course of courses) {
          const { data: newCourse, error: courseError } = await supabaseAdmin
            .from('event_courses')
            .insert({
              event_id: eventId,
              name: course.name,
              description: course.description || null,
              capacity: null, // 廃止：グローバル定員は使用しない
              display_order: course.display_order,
            })
            .select()
            .single();

          if (courseError) {
            console.error('コース作成エラー:', courseError);
            throw new Error('コースの作成に失敗しました');
          }

          // コースと日程の関連を作成 + 日程別定員を設定
          if (course.applicable_date_indices && course.applicable_date_indices.length > 0) {
            const associations = course.applicable_date_indices.map((dateIndex: number) => ({
              course_id: newCourse.id,
              date_id: createdDates[dateIndex].id,
            }));

            const { error: assocError } = await supabaseAdmin
              .from('course_date_associations')
              .insert(associations);

            if (assocError) {
              console.error('関連作成エラー:', assocError);
              throw new Error('コースと日程の関連付けに失敗しました');
            }

            // 日程別定員を course_date_capacities に保存
            if (course.date_capacities) {
              const capacityRecords = course.applicable_date_indices.map((dateIndex: number) => {
                const capacity = course.date_capacities[dateIndex];
                return {
                  course_id: newCourse.id,
                  date_id: createdDates[dateIndex].id,
                  capacity: capacity !== null && capacity !== undefined ? capacity : 0,
                  current_count: 0,
                };
              });

              const { error: capacityError } = await supabaseAdmin
                .from('course_date_capacities')
                .insert(capacityRecords);

              if (capacityError) {
                console.error('定員設定エラー:', capacityError);
                throw new Error('コース定員の設定に失敗しました');
              }
            }
          }
        }

        // 日程の定員を各コースの定員合計で再計算
        for (const date of createdDates) {
          const { data: courseCapacities } = await supabaseAdmin
            .from('course_date_capacities')
            .select('capacity')
            .eq('date_id', date.id);

          const totalCapacity = (courseCapacities || []).reduce(
            (sum, cc) => sum + (cc.capacity || 0),
            0
          );

          await supabaseAdmin
            .from('open_campus_dates')
            .update({ capacity: totalCapacity })
            .eq('id', date.id);
        }
      } catch (datesCourseError) {
        console.error('日程・コース更新エラー:', datesCourseError);
        return NextResponse.json(
          { error: '日程・コースの更新に失敗しました' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(updatedEvent);
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// イベント削除（申込者が0人の場合のみ）
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;

    console.log(`[Event DELETE] Deleting event: ${eventId}`);

    // イベントが存在するか確認
    const { data: existingEvent, error: checkError } = await supabaseAdmin
      .from('open_campus_events')
      .select('id, name')
      .eq('id', eventId)
      .single();

    if (checkError || !existingEvent) {
      return NextResponse.json(
        { error: 'イベントが見つかりません' },
        { status: 404 }
      );
    }

    // イベントに紐づく日程を取得
    const { data: existingDates } = await supabaseAdmin
      .from('open_campus_dates')
      .select('id')
      .eq('event_id', eventId);

    const dateIds = (existingDates || []).map(d => d.id);

    // 申込者数を確認
    if (dateIds.length > 0) {
      const { count: applicantCount } = await supabaseAdmin
        .from('applicant_visit_dates')
        .select('applicant_id', { count: 'exact', head: true })
        .in('visit_date_id', dateIds);

      if ((applicantCount || 0) > 0) {
        console.log(`[Event DELETE] Cannot delete event ${eventId}: has ${applicantCount} applicants`);
        return NextResponse.json(
          { error: '申込者がいるイベントは削除できません' },
          { status: 400 }
        );
      }
    }

    console.log(`[Event DELETE] Event ${eventId} has no applicants, proceeding with deletion`);

    // 1. コースと日程の関連を削除
    const { data: existingCourses } = await supabaseAdmin
      .from('event_courses')
      .select('id')
      .eq('event_id', eventId);

    const courseIds = (existingCourses || []).map(c => c.id);

    if (courseIds.length > 0) {
      const { error: assocDeleteError } = await supabaseAdmin
        .from('course_date_associations')
        .delete()
        .in('course_id', courseIds);

      if (assocDeleteError) {
        console.error('[Event DELETE] Error deleting course associations:', assocDeleteError);
        throw assocDeleteError;
      }
    }

    // 2. コースを削除
    const { error: courseDeleteError } = await supabaseAdmin
      .from('event_courses')
      .delete()
      .eq('event_id', eventId);

    if (courseDeleteError) {
      console.error('[Event DELETE] Error deleting courses:', courseDeleteError);
      throw courseDeleteError;
    }

    // 3. 日程を削除
    const { error: dateDeleteError } = await supabaseAdmin
      .from('open_campus_dates')
      .delete()
      .eq('event_id', eventId);

    if (dateDeleteError) {
      console.error('[Event DELETE] Error deleting dates:', dateDeleteError);
      throw dateDeleteError;
    }

    // 4. イベントを削除
    const { error: eventDeleteError } = await supabaseAdmin
      .from('open_campus_events')
      .delete()
      .eq('id', eventId);

    if (eventDeleteError) {
      console.error('[Event DELETE] Error deleting event:', eventDeleteError);
      throw eventDeleteError;
    }

    console.log(`[Event DELETE] Successfully deleted event: ${existingEvent.name}`);

    return NextResponse.json({
      success: true,
      message: 'イベントを削除しました',
    });
  } catch (error) {
    console.error('[Event DELETE] Server error:', error);
    return NextResponse.json(
      {
        error: 'イベントの削除に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
