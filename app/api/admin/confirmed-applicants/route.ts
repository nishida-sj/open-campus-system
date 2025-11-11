import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// 確定者一覧取得
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
      .select('id, date, event_id')
      .eq('event_id', eventId)
      .order('date', { ascending: true });

    if (!dates || dates.length === 0) {
      return NextResponse.json([]);
    }

    const dateIds = dates.map((d) => d.id);

    // 確定済み申込者のみ取得
    const { data: confirmedApplicants } = await supabaseAdmin
      .from('applicants')
      .select(`
        id,
        name,
        kana_name,
        email,
        phone,
        school_name,
        school_type,
        grade,
        confirmed_date_id,
        confirmed_course_id,
        confirmed_at,
        line_user_id,
        created_at
      `)
      .in('confirmed_date_id', dateIds)
      .eq('status', 'confirmed')
      .order('confirmed_at', { ascending: false });

    if (!confirmedApplicants || confirmedApplicants.length === 0) {
      return NextResponse.json([]);
    }

    // 各申込者の確定日程とコース情報を取得
    const applicantsWithDetails = await Promise.all(
      confirmedApplicants.map(async (applicant) => {
        // 日程情報
        const confirmedDate = dates.find((d) => d.id === applicant.confirmed_date_id);

        // コース情報
        let courseName = null;
        if (applicant.confirmed_course_id) {
          const { data: course } = await supabaseAdmin
            .from('event_courses')
            .select('name')
            .eq('id', applicant.confirmed_course_id)
            .single();

          courseName = course?.name || null;
        }

        return {
          ...applicant,
          confirmed_date: confirmedDate?.date || null,
          confirmed_course_name: courseName,
        };
      })
    );

    return NextResponse.json(applicantsWithDetails);
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// LINE通知送信
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { applicant_ids } = body;

    if (!applicant_ids || !Array.isArray(applicant_ids) || applicant_ids.length === 0) {
      return NextResponse.json(
        { error: '送信対象の申込者IDが必要です' },
        { status: 400 }
      );
    }

    // LINE Bot アクセストークン
    const lineChannelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!lineChannelAccessToken) {
      return NextResponse.json(
        { error: 'LINE設定が不足しています' },
        { status: 500 }
      );
    }

    // 申込者情報を取得
    const { data: applicants } = await supabaseAdmin
      .from('applicants')
      .select(`
        id,
        name,
        line_user_id,
        confirmed_date_id,
        confirmed_course_id
      `)
      .in('id', applicant_ids);

    if (!applicants || applicants.length === 0) {
      return NextResponse.json(
        { error: '対象の申込者が見つかりません' },
        { status: 404 }
      );
    }

    const results = [];

    for (const applicant of applicants) {
      // LINE User IDがない場合はスキップ
      if (!applicant.line_user_id) {
        results.push({
          applicant_id: applicant.id,
          name: applicant.name,
          success: false,
          error: 'LINE連携なし',
        });
        continue;
      }

      // 日程情報を取得
      const { data: dateInfo } = await supabaseAdmin
        .from('open_campus_dates')
        .select('date, event_id')
        .eq('id', applicant.confirmed_date_id)
        .single();

      // イベント情報を取得
      const { data: eventInfo } = await supabaseAdmin
        .from('open_campus_events')
        .select('name')
        .eq('id', dateInfo?.event_id)
        .single();

      // コース情報を取得
      let courseName = 'なし';
      if (applicant.confirmed_course_id) {
        const { data: courseInfo } = await supabaseAdmin
          .from('event_courses')
          .select('name')
          .eq('id', applicant.confirmed_course_id)
          .single();
        courseName = courseInfo?.name || 'なし';
      }

      // LINEメッセージを作成
      const message = {
        type: 'text',
        text: `【参加確定のお知らせ】

${applicant.name} 様

オープンキャンパスへのお申し込みが確定しました。

■ イベント名
${eventInfo?.name || '不明'}

■ 参加日時
${dateInfo ? new Date(dateInfo.date).toLocaleDateString('ja-JP', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
}) : '不明'}

■ 参加コース
${courseName}

当日お会いできることを楽しみにしております。

※このメッセージは自動送信されています。`,
      };

      // LINE APIにメッセージを送信
      try {
        const response = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${lineChannelAccessToken}`,
          },
          body: JSON.stringify({
            to: applicant.line_user_id,
            messages: [message],
          }),
        });

        if (response.ok) {
          results.push({
            applicant_id: applicant.id,
            name: applicant.name,
            success: true,
          });
        } else {
          const error = await response.text();
          console.error(`LINE送信失敗 (${applicant.name}):`, error);
          results.push({
            applicant_id: applicant.id,
            name: applicant.name,
            success: false,
            error: 'LINE送信失敗',
          });
        }
      } catch (error) {
        console.error(`LINE送信エラー (${applicant.name}):`, error);
        results.push({
          applicant_id: applicant.id,
          name: applicant.name,
          success: false,
          error: 'ネットワークエラー',
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
