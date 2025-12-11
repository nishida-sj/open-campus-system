import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { event_ids } = body;

    if (!event_ids || !Array.isArray(event_ids) || event_ids.length === 0) {
      return NextResponse.json({ error: 'イベントIDが必要です' }, { status: 400 });
    }

    // 選択されたイベントの日程を取得
    const { data: dates, error: datesError } = await supabaseAdmin
      .from('open_campus_dates')
      .select('id')
      .in('event_id', event_ids);

    if (datesError) {
      console.error('日程取得エラー:', datesError);
      return NextResponse.json({ error: '日程の取得に失敗しました' }, { status: 500 });
    }

    const dateIds = (dates || []).map((d) => d.id);

    if (dateIds.length === 0) {
      return NextResponse.json([]);
    }

    // 年度計算関数
    function getFiscalYear(dateString: string): number {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      return month >= 4 ? year : year - 1;
    }

    // 申込者と選択コース、イベント情報を取得
    const { data: visitDates, error: visitDatesError } = await supabaseAdmin
      .from('applicant_visit_dates')
      .select(`
        applicant_id,
        visit_date_id,
        selected_course_id,
        event_courses!applicant_visit_dates_selected_course_id_fkey (
          id,
          name
        ),
        open_campus_dates!applicant_visit_dates_visit_date_id_fkey (
          id,
          date,
          event_id,
          open_campus_events!open_campus_dates_event_id_fkey (
            id,
            name
          )
        )
      `)
      .in('visit_date_id', dateIds);

    if (visitDatesError) {
      console.error('申込日程取得エラー:', visitDatesError);
      return NextResponse.json(
        { error: '申込者の取得に失敗しました' },
        { status: 500 }
      );
    }

    // 申込者IDとイベント情報を集約
    const applicantIdsSet = new Set<string>();
    const applicantEventsMap = new Map<string, { event_name: string; fiscal_year: number }>();

    (visitDates || []).forEach((vd: any) => {
      applicantIdsSet.add(vd.applicant_id);

      // イベント情報を保存（最初のイベント情報を使用）
      if (!applicantEventsMap.has(vd.applicant_id) && vd.open_campus_dates?.open_campus_events) {
        const eventName = vd.open_campus_dates.open_campus_events.name;
        const fiscalYear = getFiscalYear(vd.open_campus_dates.date);
        applicantEventsMap.set(vd.applicant_id, { event_name: eventName, fiscal_year: fiscalYear });
      }
    });

    const applicantIds = Array.from(applicantIdsSet);

    if (applicantIds.length === 0) {
      return NextResponse.json([]);
    }

    // 確定済み申込者のみを取得（statusがconfirmedまたはcompleted）
    const { data: applicants, error: applicantsError } = await supabaseAdmin
      .from('applicants')
      .select(`
        id,
        name,
        email,
        line_user_id,
        school_name,
        grade,
        status,
        confirmed_date_id,
        confirmed_course_id,
        event_courses!applicants_confirmed_course_id_fkey (
          id,
          name
        )
      `)
      .in('id', applicantIds)
      .in('status', ['confirmed', 'completed'])
      .order('name', { ascending: true });

    if (applicantsError) {
      console.error('申込者情報取得エラー:', applicantsError);
      return NextResponse.json(
        { error: '申込者情報の取得に失敗しました' },
        { status: 500 }
      );
    }

    // 申込者に確定コース情報とイベント情報を追加
    const applicantsWithDetails = (applicants || []).map((applicant: any) => {
      const eventInfo = applicantEventsMap.get(applicant.id);
      const confirmedCourse = applicant.event_courses?.name;

      return {
        id: applicant.id,
        name: applicant.name,
        email: applicant.email,
        line_user_id: applicant.line_user_id,
        school_name: applicant.school_name,
        grade: applicant.grade,
        courses: confirmedCourse ? [confirmedCourse] : [],
        event_name: eventInfo?.event_name || '',
        event_fiscal_year: eventInfo?.fiscal_year || 0,
      };
    });

    return NextResponse.json(applicantsWithDetails);
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
