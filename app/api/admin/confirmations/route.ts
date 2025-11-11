import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// 申込者一覧取得（イベント別、確定/未確定で分類）
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');

    if (!eventId) {
      return NextResponse.json(
        { error: 'event_idが必要です' },
        { status: 400 }
      );
    }

    // イベントに紐づく日程IDを取得
    const { data: dates } = await supabaseAdmin
      .from('open_campus_dates')
      .select('id')
      .eq('event_id', eventId);

    if (!dates || dates.length === 0) {
      return NextResponse.json({ pending: [], confirmed: [] });
    }

    const dateIds = dates.map((d) => d.id);

    // 申込者と選択日程を取得
    const { data: applicantVisits } = await supabaseAdmin
      .from('applicant_visit_dates')
      .select(`
        applicant_id,
        visit_date_id,
        selected_course_id,
        priority,
        open_campus_dates (
          id,
          date,
          event_id
        ),
        event_courses (
          id,
          name
        ),
        applicants (
          id,
          name,
          kana_name,
          email,
          phone,
          school_name,
          school_type,
          grade,
          status,
          confirmed_date_id,
          confirmed_course_id,
          confirmed_at,
          created_at
        )
      `)
      .in('visit_date_id', dateIds);

    if (!applicantVisits) {
      return NextResponse.json({ pending: [], confirmed: [] });
    }

    // 申込者ごとにグループ化
    const applicantMap = new Map();

    for (const visit of applicantVisits) {
      const applicant: any = visit.applicants;
      if (!applicant) continue;

      if (!applicantMap.has(applicant.id)) {
        applicantMap.set(applicant.id, {
          ...applicant,
          selected_dates: [],
        });
      }

      const date: any = visit.open_campus_dates;
      const course: any = visit.event_courses;

      const applicantData: any = applicantMap.get(applicant.id);
      applicantData.selected_dates.push({
        date_id: visit.visit_date_id,
        date: date?.date,
        course_id: visit.selected_course_id,
        course_name: course?.name || null,
        priority: visit.priority,
      });
    }

    // 配列に変換してソート
    const allApplicants = Array.from(applicantMap.values()).map((applicant) => ({
      ...applicant,
      selected_dates: applicant.selected_dates.sort(
        (a: any, b: any) => a.priority - b.priority
      ),
    }));

    // 確定/未確定で分類
    const pending = allApplicants.filter((a) => !a.confirmed_date_id);
    const confirmed = allApplicants.filter((a) => a.confirmed_date_id);

    return NextResponse.json({ pending, confirmed });
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// 申込確定
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { applicant_id, confirmed_date_id, confirmed_course_id } = body;

    // バリデーション
    if (!applicant_id || !confirmed_date_id) {
      return NextResponse.json(
        { error: '必須項目が不足しています' },
        { status: 400 }
      );
    }

    // 申込者が存在するか確認
    const { data: applicant, error: applicantError } = await supabaseAdmin
      .from('applicants')
      .select('id, email')
      .eq('id', applicant_id)
      .single();

    if (applicantError || !applicant) {
      return NextResponse.json(
        { error: '申込者が見つかりません' },
        { status: 404 }
      );
    }

    // 選択日程に含まれているか確認
    const { data: visitDate } = await supabaseAdmin
      .from('applicant_visit_dates')
      .select('visit_date_id')
      .eq('applicant_id', applicant_id)
      .eq('visit_date_id', confirmed_date_id)
      .single();

    if (!visitDate) {
      return NextResponse.json(
        { error: '選択されていない日程です' },
        { status: 400 }
      );
    }

    // 確定情報を更新
    const { error: updateError } = await supabaseAdmin
      .from('applicants')
      .update({
        confirmed_date_id,
        confirmed_course_id: confirmed_course_id || null,
        confirmed_at: new Date().toISOString(),
        confirmed_by: 'admin', // 実際の管理者情報があれば使用
        status: 'confirmed',
      })
      .eq('id', applicant_id);

    if (updateError) {
      console.error('確定エラー:', updateError);
      return NextResponse.json(
        { error: '確定に失敗しました' },
        { status: 500 }
      );
    }

    // 定員カウントを増加（確定した日程のみ）
    const { error: countError } = await supabaseAdmin.rpc('increment_visit_count', {
      date_id: confirmed_date_id,
    });

    if (countError) {
      console.error('カウント更新エラー:', countError);
      // カウント失敗時はログのみ（確定は成功とする）
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// 確定解除
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { applicant_id } = body;

    if (!applicant_id) {
      return NextResponse.json(
        { error: 'applicant_idが必要です' },
        { status: 400 }
      );
    }

    // 現在の確定情報を取得
    const { data: applicant, error: fetchError } = await supabaseAdmin
      .from('applicants')
      .select('confirmed_date_id')
      .eq('id', applicant_id)
      .single();

    if (fetchError || !applicant) {
      return NextResponse.json(
        { error: '申込者が見つかりません' },
        { status: 404 }
      );
    }

    const previousDateId = applicant.confirmed_date_id;

    // 確定情報をクリア
    const { error: updateError } = await supabaseAdmin
      .from('applicants')
      .update({
        confirmed_date_id: null,
        confirmed_course_id: null,
        confirmed_at: null,
        confirmed_by: null,
        status: 'pending',
      })
      .eq('id', applicant_id);

    if (updateError) {
      console.error('解除エラー:', updateError);
      return NextResponse.json(
        { error: '解除に失敗しました' },
        { status: 500 }
      );
    }

    // 定員カウントを減少（以前確定していた日程）
    if (previousDateId) {
      const { error: countError } = await supabaseAdmin.rpc('decrement_visit_count', {
        date_id: previousDateId,
      });

      if (countError) {
        console.error('カウント減少エラー:', countError);
        // カウント失敗時はログのみ
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
