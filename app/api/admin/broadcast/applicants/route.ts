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

    // 申込者を取得（重複を除外）
    const { data: visitDates, error: visitDatesError } = await supabaseAdmin
      .from('applicant_visit_dates')
      .select('applicant_id')
      .in('visit_date_id', dateIds);

    if (visitDatesError) {
      console.error('申込日程取得エラー:', visitDatesError);
      return NextResponse.json(
        { error: '申込者の取得に失敗しました' },
        { status: 500 }
      );
    }

    const applicantIds = Array.from(
      new Set((visitDates || []).map((vd) => vd.applicant_id))
    );

    if (applicantIds.length === 0) {
      return NextResponse.json([]);
    }

    // 申込者情報を取得
    const { data: applicants, error: applicantsError } = await supabaseAdmin
      .from('applicants')
      .select('id, name, email, line_user_id, school_name, grade')
      .in('id', applicantIds)
      .order('name', { ascending: true });

    if (applicantsError) {
      console.error('申込者情報取得エラー:', applicantsError);
      return NextResponse.json(
        { error: '申込者情報の取得に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json(applicants || []);
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
