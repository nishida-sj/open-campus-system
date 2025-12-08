import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { randomBytes } from 'crypto';

interface DateSelection {
  date_id: string;
  course_id: string | null;
  course_ids?: string[]; // 同日複数コース選択時に使用
  priority?: number;
}

export async function POST(request: Request) {
  try {
    // リクエストボディを取得
    const body = await request.json();
    const {
      event_id,
      name,
      kana_name,
      email,
      phone,
      school_name,
      school_type,
      grade,
      selected_dates,
      guardian_attendance,
      guardian_name,
      guardian_phone,
      remarks,
    } = body;

    // 基本バリデーション
    if (!event_id || !name || !email || !phone || !school_name || !grade) {
      return NextResponse.json(
        { error: '必須項目を入力してください' },
        { status: 400 }
      );
    }

    if (!selected_dates || !Array.isArray(selected_dates) || selected_dates.length === 0) {
      return NextResponse.json(
        { error: '参加日程を選択してください' },
        { status: 400 }
      );
    }

    // イベント情報を取得
    const { data: event, error: eventError } = await supabaseAdmin
      .from('open_campus_events')
      .select('allow_multiple_dates, allow_multiple_candidates, allow_multiple_courses_same_date, max_date_selections')
      .eq('id', event_id)
      .eq('is_active', true)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'イベントが見つかりません' },
        { status: 404 }
      );
    }

    // 日程選択数のバリデーション
    if (!event.allow_multiple_dates && !event.allow_multiple_candidates && selected_dates.length > 1) {
      return NextResponse.json(
        { error: 'このイベントは単一日程のみ選択可能です' },
        { status: 400 }
      );
    }

    if (
      event.max_date_selections !== 999 &&
      selected_dates.length > event.max_date_selections
    ) {
      return NextResponse.json(
        { error: `最大${event.max_date_selections}日程まで選択できます` },
        { status: 400 }
      );
    }

    // 各日程の定員チェック
    for (const selection of selected_dates) {
      const { data: dateInfo, error: dateError } = await supabaseAdmin
        .from('open_campus_dates')
        .select('capacity, current_count, event_id')
        .eq('id', selection.date_id)
        .single();

      if (dateError || !dateInfo) {
        return NextResponse.json(
          { error: '日程情報の取得に失敗しました' },
          { status: 500 }
        );
      }

      if (dateInfo.event_id !== event_id) {
        return NextResponse.json(
          { error: '無効な日程が選択されています' },
          { status: 400 }
        );
      }

      // 注意: current_countは管理者確定時に増加するため、ここではチェックしない
      // 申込は候補日の登録なので、定員チェックは確定時に行う
    }

    // 重複チェック（同じイベント、同じメールアドレス、同じ日程）
    for (const selection of selected_dates) {
      const { data: existing } = await supabaseAdmin
        .from('applicant_visit_dates')
        .select('applicant:applicants!inner(email, id)')
        .eq('visit_date_id', selection.date_id);

      if (existing && existing.length > 0) {
        const duplicate = existing.find((e: any) => e.applicant?.email === email);
        if (duplicate) {
          return NextResponse.json(
            { error: 'この日程で既に申込済みです' },
            { status: 400 }
          );
        }
      }
    }

    // トークン生成
    const token = randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setMinutes(tokenExpiresAt.getMinutes() + 30);

    // applicantsテーブルに登録
    // visit_date_idは後方互換性のため、最初の選択日程を設定
    const firstDateId = selected_dates[0].date_id;

    const { data: applicant, error: insertError } = await supabaseAdmin
      .from('applicants')
      .insert({
        name,
        kana_name: kana_name || null,
        email,
        phone,
        school_name,
        school_type: school_type || null,
        grade,
        interested_course_id: null, // 旧コースフィールドはnull
        visit_date_id: firstDateId, // 後方互換性
        guardian_attendance: guardian_attendance || false,
        guardian_name: guardian_attendance ? guardian_name : null,
        guardian_phone: guardian_attendance ? guardian_phone : null,
        remarks: remarks || null,
        token,
        token_expires_at: tokenExpiresAt.toISOString(),
        status: 'pending',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('申込登録エラー:', insertError);
      return NextResponse.json(
        { error: '申込の登録に失敗しました' },
        { status: 500 }
      );
    }

    // applicant_visit_datesに複数日程を登録
    // 同日複数コース選択の場合は、course_idsを展開して複数レコードを作成
    const visitDateEntries: any[] = [];

    selected_dates.forEach((selection: DateSelection, index: number) => {
      // 同日複数コース選択の場合
      if (event.allow_multiple_courses_same_date && selection.course_ids && selection.course_ids.length > 0) {
        selection.course_ids.forEach((courseId) => {
          visitDateEntries.push({
            applicant_id: applicant.id,
            visit_date_id: selection.date_id,
            selected_course_id: courseId,
            priority: selection.priority || (index + 1),
          });
        });
      } else {
        // 通常の単一コース選択の場合
        visitDateEntries.push({
          applicant_id: applicant.id,
          visit_date_id: selection.date_id,
          selected_course_id: selection.course_id,
          priority: selection.priority || (index + 1),
        });
      }
    });

    const { error: visitDatesError } = await supabaseAdmin
      .from('applicant_visit_dates')
      .insert(visitDateEntries);

    if (visitDatesError) {
      console.error('日程登録エラー:', visitDatesError);
      // ロールバック
      await supabaseAdmin.from('applicants').delete().eq('id', applicant.id);
      return NextResponse.json(
        { error: '参加日程の登録に失敗しました' },
        { status: 500 }
      );
    }

    // ログ記録
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || '';

    await supabaseAdmin.from('application_logs').insert({
      applicant_id: applicant.id,
      action: 'created',
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    // 成功レスポンス
    return NextResponse.json({
      success: true,
      token,
      applicant_id: applicant.id,
    });
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
