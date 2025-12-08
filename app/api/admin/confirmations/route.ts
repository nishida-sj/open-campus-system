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
          guardian_attendance,
          guardian_name,
          guardian_phone,
          status,
          created_at
        )
      `)
      .in('visit_date_id', dateIds);

    if (!applicantVisits) {
      return NextResponse.json({ pending: [], confirmed: [] });
    }

    // 全申込者の確定情報を取得
    const applicantIds = [...new Set(applicantVisits.map((v: any) => v.applicant_id))];
    const { data: confirmations } = await supabaseAdmin
      .from('confirmed_participations')
      .select('*')
      .in('applicant_id', applicantIds)
      .in('confirmed_date_id', dateIds);

    // 申込者ごとにグループ化
    const applicantMap = new Map();

    for (const visit of applicantVisits) {
      const applicant: any = visit.applicants;
      if (!applicant) continue;

      if (!applicantMap.has(applicant.id)) {
        applicantMap.set(applicant.id, {
          ...applicant,
          selected_dates: [],
          confirmed_dates: [],
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

    // 確定情報を追加
    if (confirmations) {
      for (const confirmation of confirmations) {
        const applicantData: any = applicantMap.get(confirmation.applicant_id);
        if (applicantData) {
          applicantData.confirmed_dates.push({
            date_id: confirmation.confirmed_date_id,
            course_id: confirmation.confirmed_course_id,
            confirmed_at: confirmation.confirmed_at,
          });
        }
      }
    }

    // 配列に変換してソート
    const allApplicants = Array.from(applicantMap.values()).map((applicant) => ({
      ...applicant,
      selected_dates: applicant.selected_dates.sort(
        (a: any, b: any) => a.priority - b.priority
      ),
    }));

    // 確定/未確定で分類（確定日程が1つでもあれば確定とみなす）
    const pending = allApplicants.filter((a: any) => a.confirmed_dates.length === 0);
    const confirmed = allApplicants.filter((a: any) => a.confirmed_dates.length > 0);

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

    // イベント設定を取得（複数日参加が許可されているか確認）
    const { data: dateInfo } = await supabaseAdmin
      .from('open_campus_dates')
      .select('event_id, open_campus_events(allow_multiple_dates)')
      .eq('id', confirmed_date_id)
      .single();

    const allowMultipleDates = (dateInfo as any)?.open_campus_events?.allow_multiple_dates || false;

    // 既存の確定をチェック
    const { data: existingConfirmations } = await supabaseAdmin
      .from('confirmed_participations')
      .select('id, confirmed_date_id')
      .eq('applicant_id', applicant_id);

    // 複数日参加が許可されていない場合、既に別の日程が確定していたらエラー
    if (!allowMultipleDates && existingConfirmations && existingConfirmations.length > 0) {
      const existingDate = existingConfirmations[0];
      if (existingDate.confirmed_date_id !== confirmed_date_id) {
        return NextResponse.json(
          { error: 'このイベントは複数日参加が許可されていません。既に他の日程が確定されています。' },
          { status: 400 }
        );
      }
    }

    // 同じ日程が既に確定されているかチェック
    const alreadyConfirmed = existingConfirmations?.find(
      (c: any) => c.confirmed_date_id === confirmed_date_id
    );

    if (alreadyConfirmed) {
      // 既に確定済みの場合はコース情報のみ更新
      const { error: updateError } = await supabaseAdmin
        .from('confirmed_participations')
        .update({
          confirmed_course_id: confirmed_course_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', alreadyConfirmed.id);

      if (updateError) {
        console.error('コース更新エラー:', updateError);
        return NextResponse.json(
          { error: 'コース情報の更新に失敗しました' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, updated: true });
    }

    // 新規確定を作成
    const { error: insertError } = await supabaseAdmin
      .from('confirmed_participations')
      .insert({
        applicant_id,
        confirmed_date_id,
        confirmed_course_id: confirmed_course_id || null,
        confirmed_by: 'admin',
      });

    if (insertError) {
      console.error('確定エラー:', insertError);
      return NextResponse.json(
        { error: '確定に失敗しました' },
        { status: 500 }
      );
    }

    // 申込者のステータスを確定に更新
    const { error: statusUpdateError } = await supabaseAdmin
      .from('applicants')
      .update({
        status: 'confirmed',
      })
      .eq('id', applicant_id);

    if (statusUpdateError) {
      console.error('ステータス更新エラー:', statusUpdateError);
    }

    // 日程のカウントを増加
    const { error: countError } = await supabaseAdmin.rpc('increment_visit_count', {
      date_id: confirmed_date_id,
    });

    if (countError) {
      console.error('カウント更新エラー:', countError);
    }

    return NextResponse.json({ success: true, created: true });
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// 確定解除（特定の日程の確定を解除）
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { applicant_id, confirmed_date_id } = body;

    if (!applicant_id) {
      return NextResponse.json(
        { error: 'applicant_idが必要です' },
        { status: 400 }
      );
    }

    // confirmed_date_idが指定されている場合は特定の日程のみ解除
    // 指定されていない場合は全ての確定を解除
    let query = supabaseAdmin
      .from('confirmed_participations')
      .select('id, confirmed_date_id')
      .eq('applicant_id', applicant_id);

    if (confirmed_date_id) {
      query = query.eq('confirmed_date_id', confirmed_date_id);
    }

    const { data: confirmations, error: fetchError } = await query;

    if (fetchError) {
      console.error('確定情報取得エラー:', fetchError);
      return NextResponse.json(
        { error: '確定情報の取得に失敗しました' },
        { status: 500 }
      );
    }

    if (!confirmations || confirmations.length === 0) {
      return NextResponse.json(
        { error: '確定情報が見つかりません' },
        { status: 404 }
      );
    }

    // 確定を削除
    const confirmationIds = confirmations.map((c) => c.id);
    const { error: deleteError } = await supabaseAdmin
      .from('confirmed_participations')
      .delete()
      .in('id', confirmationIds);

    if (deleteError) {
      console.error('解除エラー:', deleteError);
      return NextResponse.json(
        { error: '解除に失敗しました' },
        { status: 500 }
      );
    }

    // 各日程のカウントを減少
    for (const confirmation of confirmations) {
      const { error: countError } = await supabaseAdmin.rpc('decrement_visit_count', {
        date_id: confirmation.confirmed_date_id,
      });

      if (countError) {
        console.error('カウント減少エラー:', countError);
      }
    }

    // 全ての確定が解除された場合、申込者のステータスを未確定に戻す
    if (!confirmed_date_id) {
      const { error: statusUpdateError } = await supabaseAdmin
        .from('applicants')
        .update({
          status: 'pending',
        })
        .eq('id', applicant_id);

      if (statusUpdateError) {
        console.error('ステータス更新エラー:', statusUpdateError);
      }
    } else {
      // 特定の日程のみ解除した場合、他に確定がなければステータスを未確定に戻す
      const { data: remainingConfirmations } = await supabaseAdmin
        .from('confirmed_participations')
        .select('id')
        .eq('applicant_id', applicant_id);

      if (!remainingConfirmations || remainingConfirmations.length === 0) {
        const { error: statusUpdateError } = await supabaseAdmin
          .from('applicants')
          .update({
            status: 'pending',
          })
          .eq('id', applicant_id);

        if (statusUpdateError) {
          console.error('ステータス更新エラー:', statusUpdateError);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
