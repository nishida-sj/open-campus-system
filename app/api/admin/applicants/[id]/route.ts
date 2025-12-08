import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// 申込者の編集（日程・コース変更）
export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const applicantId = params.id;
    const body = await request.json();
    const { visit_date_id, selected_course_id } = body;

    if (!visit_date_id) {
      return NextResponse.json(
        { error: '日程IDが必要です' },
        { status: 400 }
      );
    }

    // 申込者が存在するか確認
    const { data: applicant, error: applicantError } = await supabaseAdmin
      .from('applicants')
      .select('id, visit_date_id')
      .eq('id', applicantId)
      .single();

    if (applicantError || !applicant) {
      return NextResponse.json(
        { error: '申込者が見つかりません' },
        { status: 404 }
      );
    }

    // 変更日程が同じイベント内か確認
    const { data: oldDate } = await supabaseAdmin
      .from('open_campus_dates')
      .select('event_id')
      .eq('id', applicant.visit_date_id)
      .single();

    const { data: newDate } = await supabaseAdmin
      .from('open_campus_dates')
      .select('event_id')
      .eq('id', visit_date_id)
      .single();

    if (oldDate?.event_id !== newDate?.event_id) {
      return NextResponse.json(
        { error: '異なるイベントの日程には変更できません' },
        { status: 400 }
      );
    }

    // applicant_visit_datesを更新
    const { error: updateVisitError } = await supabaseAdmin
      .from('applicant_visit_dates')
      .update({
        visit_date_id,
        selected_course_id: selected_course_id || null,
      })
      .eq('applicant_id', applicantId)
      .eq('visit_date_id', applicant.visit_date_id);

    if (updateVisitError) {
      console.error('日程更新エラー:', updateVisitError);
      return NextResponse.json(
        { error: '日程の更新に失敗しました' },
        { status: 500 }
      );
    }

    // applicantsテーブルも更新（後方互換性のため）
    const { error: updateApplicantError } = await supabaseAdmin
      .from('applicants')
      .update({
        visit_date_id,
        interested_course_id: selected_course_id || null,
      })
      .eq('id', applicantId);

    if (updateApplicantError) {
      console.error('申込者更新エラー:', updateApplicantError);
    }

    // 確定情報も更新
    const { error: updateConfirmationError } = await supabaseAdmin
      .from('confirmed_participations')
      .update({
        confirmed_date_id: visit_date_id,
        confirmed_course_id: selected_course_id || null,
      })
      .eq('applicant_id', applicantId)
      .eq('confirmed_date_id', applicant.visit_date_id);

    if (updateConfirmationError) {
      console.error('確定情報更新エラー:', updateConfirmationError);
    }

    // 編集ログを記録
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || '';

    await supabaseAdmin.from('application_logs').insert({
      applicant_id: applicantId,
      action: 'modified',
      ip_address: ipAddress,
      user_agent: userAgent,
      details: JSON.stringify({
        old_date_id: applicant.visit_date_id,
        new_date_id: visit_date_id,
        new_course_id: selected_course_id,
      }),
    });

    return NextResponse.json({
      success: true,
      message: '申込者情報を更新しました'
    });
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
