import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getTenantBySlug } from '@/lib/tenant';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> }
) {
  try {
    const { tenant: slug, id: eventId } = await params;
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const { data: event, error: eventError } = await supabaseAdmin
      .from('open_campus_events')
      .select('*')
      .eq('id', eventId)
      .eq('tenant_id', tenant.id)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'イベントが見つかりません' }, { status: 404 });
    }

    const { data: dates, error: datesError } = await supabaseAdmin
      .from('open_campus_dates')
      .select('*')
      .eq('event_id', eventId)
      .eq('tenant_id', tenant.id)
      .order('date', { ascending: true });

    if (datesError) {
      return NextResponse.json({ error: '日程の取得に失敗しました' }, { status: 500 });
    }

    const datesWithApplicants = await Promise.all(
      (dates || []).map(async (date) => {
        const { count } = await supabaseAdmin
          .from('applicant_visit_dates')
          .select('*', { count: 'exact', head: true })
          .eq('visit_date_id', date.id);
        return { ...date, has_applicants: (count || 0) > 0 };
      })
    );

    const { data: courses, error: coursesError } = await supabaseAdmin
      .from('event_courses')
      .select('*')
      .eq('event_id', eventId)
      .eq('tenant_id', tenant.id)
      .order('display_order', { ascending: true });

    if (coursesError) {
      return NextResponse.json({ error: 'コースの取得に失敗しました' }, { status: 500 });
    }

    const coursesWithDates = await Promise.all(
      (courses || []).map(async (course) => {
        const { data: associations } = await supabaseAdmin
          .from('course_date_associations')
          .select('date_id')
          .eq('course_id', course.id);
        const applicableDateIds = (associations || []).map(a => a.date_id);

        const { data: dateCapacities } = await supabaseAdmin
          .from('course_date_capacities')
          .select('date_id, capacity')
          .eq('course_id', course.id);
        const dateCapacitiesMap: { [dateId: string]: number | null } = {};
        (dateCapacities || []).forEach(dc => { dateCapacitiesMap[dc.date_id] = dc.capacity; });

        return { ...course, applicable_date_ids: applicableDateIds, date_capacities: dateCapacitiesMap };
      })
    );

    const dateIds = (dates || []).map(d => d.id);
    const { count: totalApplicants } = dateIds.length > 0
      ? await supabaseAdmin
          .from('applicant_visit_dates')
          .select('applicant_id', { count: 'exact', head: true })
          .in('visit_date_id', dateIds)
      : { count: 0 };

    return NextResponse.json({ event, dates: datesWithApplicants, courses: coursesWithDates, total_applicants: totalApplicants || 0 });
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> }
) {
  try {
    const { tenant: slug, id: eventId } = await params;
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const body = await request.json();
    const { name, description, overview, confirmation_message, display_end_date, is_active, allow_multiple_dates, allow_multiple_candidates, allow_multiple_courses_same_date, max_date_selections, dates, courses } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'イベント名を入力してください' }, { status: 400 });
    }

    const { data: existingEvent, error: checkError } = await supabaseAdmin
      .from('open_campus_events')
      .select('id')
      .eq('id', eventId)
      .eq('tenant_id', tenant.id)
      .single();

    if (checkError || !existingEvent) {
      return NextResponse.json({ error: 'イベントが見つかりません' }, { status: 404 });
    }

    if (dates || courses) {
      const { data: existingDates } = await supabaseAdmin
        .from('open_campus_dates')
        .select('id')
        .eq('event_id', eventId)
        .eq('tenant_id', tenant.id);

      const dateIds = (existingDates || []).map(d => d.id);
      const { count: applicantCount } = dateIds.length > 0
        ? await supabaseAdmin
            .from('applicant_visit_dates')
            .select('applicant_id', { count: 'exact', head: true })
            .in('visit_date_id', dateIds)
        : { count: 0 };

      if ((applicantCount || 0) > 0) {
        return NextResponse.json({ error: '申込者がいるイベントの日程・コースは変更できません' }, { status: 400 });
      }
    }

    const { data: existingDatesForCount } = await supabaseAdmin
      .from('open_campus_dates')
      .select('id')
      .eq('event_id', eventId)
      .eq('tenant_id', tenant.id);

    const dateIdsForCount = (existingDatesForCount || []).map(d => d.id);
    const { count: totalApplicants } = dateIdsForCount.length > 0
      ? await supabaseAdmin
          .from('applicant_visit_dates')
          .select('applicant_id', { count: 'exact', head: true })
          .in('visit_date_id', dateIdsForCount)
      : { count: 0 };

    const updateData: any = {
      name,
      description: description || null,
      overview: overview || null,
      confirmation_message: confirmation_message || null,
      display_end_date: display_end_date || null,
      is_active: is_active !== undefined ? is_active : true,
      updated_at: new Date().toISOString(),
    };

    if ((totalApplicants || 0) === 0) {
      const newAllowMultipleDates = allow_multiple_dates !== undefined ? allow_multiple_dates : updateData.allow_multiple_dates;
      const newAllowMultipleCandidates = allow_multiple_candidates !== undefined ? allow_multiple_candidates : updateData.allow_multiple_candidates;

      if (newAllowMultipleDates && newAllowMultipleCandidates) {
        return NextResponse.json({ error: '複数日参加と複数候補入力は同時に許可できません' }, { status: 400 });
      }

      if (allow_multiple_dates !== undefined) updateData.allow_multiple_dates = allow_multiple_dates;
      if (allow_multiple_candidates !== undefined) updateData.allow_multiple_candidates = allow_multiple_candidates;
      if (allow_multiple_courses_same_date !== undefined) updateData.allow_multiple_courses_same_date = allow_multiple_courses_same_date;
      if (max_date_selections !== undefined) updateData.max_date_selections = max_date_selections;
    }

    const { data: updatedEvent, error: updateError } = await supabaseAdmin
      .from('open_campus_events')
      .update(updateData)
      .eq('id', eventId)
      .eq('tenant_id', tenant.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 });
    }

    if (dates && courses) {
      try {
        const { data: existingCourses } = await supabaseAdmin
          .from('event_courses')
          .select('id')
          .eq('event_id', eventId)
          .eq('tenant_id', tenant.id);

        const existingCourseIds = (existingCourses || []).map(c => c.id);

        if (existingCourseIds.length > 0) {
          await supabaseAdmin.from('course_date_associations').delete().in('course_id', existingCourseIds);
        }

        await supabaseAdmin.from('event_courses').delete().eq('event_id', eventId).eq('tenant_id', tenant.id);
        await supabaseAdmin.from('open_campus_dates').delete().eq('event_id', eventId).eq('tenant_id', tenant.id);

        const createdDates: Array<{ id: string; date: string; capacity: number }> = [];
        for (const date of dates) {
          const { data: newDate, error: dateError } = await supabaseAdmin
            .from('open_campus_dates')
            .insert({ tenant_id: tenant.id, event_id: eventId, date: date.date, capacity: date.capacity, current_count: 0, is_active: true })
            .select()
            .single();

          if (dateError) throw new Error('日程の作成に失敗しました');
          createdDates.push(newDate);
        }

        for (const course of courses) {
          const { data: newCourse, error: courseError } = await supabaseAdmin
            .from('event_courses')
            .insert({ tenant_id: tenant.id, event_id: eventId, name: course.name, description: course.description || null, capacity: null, display_order: course.display_order })
            .select()
            .single();

          if (courseError) throw new Error('コースの作成に失敗しました');

          if (course.applicable_date_indices && course.applicable_date_indices.length > 0) {
            const associations = course.applicable_date_indices.map((dateIndex: number) => ({
              tenant_id: tenant.id, course_id: newCourse.id, date_id: createdDates[dateIndex].id,
            }));

            const { error: assocError } = await supabaseAdmin.from('course_date_associations').insert(associations);
            if (assocError) throw new Error('コースと日程の関連付けに失敗しました');

            if (course.date_capacities) {
              const capacityRecords = course.applicable_date_indices.map((dateIndex: number) => {
                const capacity = course.date_capacities[dateIndex];
                return { tenant_id: tenant.id, course_id: newCourse.id, date_id: createdDates[dateIndex].id, capacity: capacity !== null && capacity !== undefined ? capacity : 0, current_count: 0 };
              });

              const { error: capacityError } = await supabaseAdmin.from('course_date_capacities').insert(capacityRecords);
              if (capacityError) throw new Error('コース定員の設定に失敗しました');
            }
          }
        }

        for (const date of createdDates) {
          const { data: courseCapacities } = await supabaseAdmin
            .from('course_date_capacities')
            .select('capacity')
            .eq('date_id', date.id);

          const totalCapacity = (courseCapacities || []).reduce((sum, cc) => sum + (cc.capacity || 0), 0);
          await supabaseAdmin.from('open_campus_dates').update({ capacity: totalCapacity }).eq('id', date.id);
        }
      } catch (datesCourseError) {
        return NextResponse.json({ error: '日程・コースの更新に失敗しました' }, { status: 500 });
      }
    }

    return NextResponse.json(updatedEvent);
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> }
) {
  try {
    const { tenant: slug, id: eventId } = await params;
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const { data: existingEvent, error: checkError } = await supabaseAdmin
      .from('open_campus_events')
      .select('id, name')
      .eq('id', eventId)
      .eq('tenant_id', tenant.id)
      .single();

    if (checkError || !existingEvent) {
      return NextResponse.json({ error: 'イベントが見つかりません' }, { status: 404 });
    }

    const { data: existingDates } = await supabaseAdmin
      .from('open_campus_dates')
      .select('id')
      .eq('event_id', eventId)
      .eq('tenant_id', tenant.id);

    const dateIds = (existingDates || []).map(d => d.id);

    if (dateIds.length > 0) {
      const { count: applicantCount } = await supabaseAdmin
        .from('applicant_visit_dates')
        .select('applicant_id', { count: 'exact', head: true })
        .in('visit_date_id', dateIds);

      if ((applicantCount || 0) > 0) {
        return NextResponse.json({ error: '申込者がいるイベントは削除できません' }, { status: 400 });
      }
    }

    const { data: existingCourses } = await supabaseAdmin
      .from('event_courses')
      .select('id')
      .eq('event_id', eventId)
      .eq('tenant_id', tenant.id);

    const courseIds = (existingCourses || []).map(c => c.id);

    if (courseIds.length > 0) {
      await supabaseAdmin.from('course_date_associations').delete().in('course_id', courseIds);
    }

    await supabaseAdmin.from('event_courses').delete().eq('event_id', eventId).eq('tenant_id', tenant.id);
    await supabaseAdmin.from('open_campus_dates').delete().eq('event_id', eventId).eq('tenant_id', tenant.id);
    await supabaseAdmin.from('open_campus_events').delete().eq('id', eventId).eq('tenant_id', tenant.id);

    return NextResponse.json({ success: true, message: 'イベントを削除しました' });
  } catch (error) {
    console.error('[Event DELETE] Server error:', error);
    return NextResponse.json({ error: 'イベントの削除に失敗しました', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
