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

    // イベントに紐づく日程情報を取得（定員情報含む）
    const { data: dates } = await supabaseAdmin
      .from('open_campus_dates')
      .select('id, date, capacity, current_count')
      .eq('event_id', eventId)
      .order('date', { ascending: true });

    if (!dates || dates.length === 0) {
      return NextResponse.json({
        pending: [],
        confirmed: [],
        dates: [],
        courses: [],
        overall_stats: { total_capacity: 0, total_applicants: 0, total_confirmed: 0 }
      });
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
          is_modified: false,
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

    // 編集されたかチェック
    if (applicantIds.length > 0) {
      const { data: modifiedLogs } = await supabaseAdmin
        .from('application_logs')
        .select('applicant_id')
        .in('applicant_id', applicantIds)
        .eq('action', 'modified');

      if (modifiedLogs && modifiedLogs.length > 0) {
        const modifiedSet = new Set(modifiedLogs.map((log: any) => log.applicant_id));
        for (const [applicantId, applicantData] of applicantMap.entries()) {
          if (modifiedSet.has(applicantId)) {
            (applicantData as any).is_modified = true;
          }
        }
      }
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

    // 定員統計情報を計算
    const datesWithStats = await Promise.all(
      dates.map(async (date) => {
        // 各日程の申込数をカウント
        const { count: applicantCount } = await supabaseAdmin
          .from('applicant_visit_dates')
          .select('applicant_id', { count: 'exact', head: true })
          .eq('visit_date_id', date.id);

        // コース×日程別定員を取得
        const { data: courseCapacities } = await supabaseAdmin
          .from('course_date_capacities')
          .select('capacity, current_count, course_id')
          .eq('date_id', date.id);

        // コース名を取得
        const courseCapacitiesWithNames = await Promise.all(
          (courseCapacities || []).map(async (cc: any) => {
            const { data: courseData } = await supabaseAdmin
              .from('event_courses')
              .select('name')
              .eq('id', cc.course_id)
              .single();

            // このコースの申込数をカウント
            const { count: courseApplicantCount } = await supabaseAdmin
              .from('applicant_visit_dates')
              .select('applicant_id', { count: 'exact', head: true })
              .eq('visit_date_id', date.id)
              .eq('selected_course_id', cc.course_id);

            return {
              course_id: cc.course_id,
              course_name: courseData?.name || '不明',
              capacity: cc.capacity,
              applicant_count: courseApplicantCount || 0,
              confirmed_count: cc.current_count,
            };
          })
        );

        return {
          id: date.id,
          date: date.date,
          capacity: date.capacity,
          applicant_count: applicantCount || 0,
          confirmed_count: date.current_count,
          course_capacities: courseCapacitiesWithNames,
        };
      })
    );

    // イベント全体のコース情報を取得
    const { data: eventCourses } = await supabaseAdmin
      .from('event_courses')
      .select('id, name')
      .eq('event_id', eventId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    // 全体統計を計算
    const overallStats = {
      total_capacity: datesWithStats.reduce((sum, d) => sum + d.capacity, 0),
      total_applicants: datesWithStats.reduce((sum, d) => sum + d.applicant_count, 0),
      total_confirmed: datesWithStats.reduce((sum, d) => sum + d.confirmed_count, 0),
    };

    return NextResponse.json({
      pending,
      confirmed,
      dates: datesWithStats,
      courses: eventCourses || [],
      overall_stats: overallStats,
    });
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
      // 古いコース情報を取得
      const { data: oldConfirmation } = await supabaseAdmin
        .from('confirmed_participations')
        .select('confirmed_course_id')
        .eq('id', alreadyConfirmed.id)
        .single();

      const oldCourseId = oldConfirmation?.confirmed_course_id;

      // コース情報を更新
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

      // コース別カウントを更新
      if (oldCourseId && oldCourseId !== confirmed_course_id) {
        // 古いコースのカウントを減らす
        await supabaseAdmin.rpc('decrement_course_date_count', {
          p_date_id: confirmed_date_id,
          p_course_id: oldCourseId,
        });
      }

      if (confirmed_course_id && oldCourseId !== confirmed_course_id) {
        // 新しいコースのカウントを増やす
        await supabaseAdmin.rpc('increment_course_date_count', {
          p_date_id: confirmed_date_id,
          p_course_id: confirmed_course_id,
        });
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

    // カウントを増加
    if (confirmed_course_id) {
      // コースIDがある場合はコース別カウントを増やす（日程のカウントも自動更新される）
      const { error: countError } = await supabaseAdmin.rpc('increment_course_date_count', {
        p_date_id: confirmed_date_id,
        p_course_id: confirmed_course_id,
      });

      if (countError) {
        console.error('コース別カウント更新エラー:', countError);
      }
    } else {
      // コースIDがない場合は日程のカウントのみ増やす
      const { error: countError } = await supabaseAdmin.rpc('increment_visit_count', {
        date_id: confirmed_date_id,
      });

      if (countError) {
        console.error('カウント更新エラー:', countError);
      }
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
      .select('id, confirmed_date_id, confirmed_course_id')
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
      if (confirmation.confirmed_course_id) {
        // コースIDがある場合はコース別カウントを減らす（日程のカウントも自動更新される）
        const { error: countError } = await supabaseAdmin.rpc('decrement_course_date_count', {
          p_date_id: confirmation.confirmed_date_id,
          p_course_id: confirmation.confirmed_course_id,
        });

        if (countError) {
          console.error('コース別カウント減少エラー:', countError);
        }
      } else {
        // コースIDがない場合は日程のカウントのみ減らす
        const { error: countError } = await supabaseAdmin.rpc('decrement_visit_count', {
          date_id: confirmation.confirmed_date_id,
        });

        if (countError) {
          console.error('カウント減少エラー:', countError);
        }
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
