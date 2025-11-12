import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    // open_campus_datesテーブルから全レコードを取得
    // date順（昇順）でソート
    const { data: dates, error } = await supabaseAdmin
      .from('open_campus_dates')
      .select('id, date, capacity, current_count, is_active, event_id')
      .order('date', { ascending: true });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: '開催日程一覧の取得に失敗しました' },
        { status: 500 }
      );
    }

    // 各日程の申込数とコース情報を追加
    const datesWithApplicantCount = await Promise.all(
      (dates || []).map(async (date) => {
        const { count: applicantCount } = await supabaseAdmin
          .from('applicant_visit_dates')
          .select('applicant_id', { count: 'exact', head: true })
          .eq('visit_date_id', date.id);

        // コース×日程別定員を取得
        const { data: courseCapacities, error: courseError } = await supabaseAdmin
          .from('course_date_capacities')
          .select('capacity, current_count, course_id')
          .eq('date_id', date.id);

        if (courseError) {
          console.error('Course capacities error:', courseError);
        }

        // コース名を取得
        const courseCapacitiesWithNames = await Promise.all(
          (courseCapacities || []).map(async (cc: any) => {
            const { data: courseData } = await supabaseAdmin
              .from('event_courses')
              .select('name')
              .eq('id', cc.course_id)
              .single();

            return {
              course_id: cc.course_id,
              course_name: courseData?.name || '不明',
              capacity: cc.capacity,
              current_count: cc.current_count,
            };
          })
        );

        return {
          ...date,
          applicant_count: applicantCount || 0,
          course_capacities: courseCapacitiesWithNames,
        };
      })
    );

    return NextResponse.json(datesWithApplicantCount);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
