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

    // 確定参加情報を取得
    const { data: confirmations } = await supabaseAdmin
      .from('confirmed_participations')
      .select(`
        id,
        applicant_id,
        confirmed_date_id,
        confirmed_course_id,
        confirmed_at,
        applicants (
          id,
          name,
          kana_name,
          email,
          phone,
          school_name,
          school_type,
          grade,
          line_user_id,
          guardian_attendance,
          guardian_name,
          guardian_phone,
          created_at
        )
      `)
      .in('confirmed_date_id', dateIds)
      .order('confirmed_at', { ascending: false });

    if (!confirmations || confirmations.length === 0) {
      return NextResponse.json([]);
    }

    // 申込者ごとにグループ化し、確定日程情報を集約
    const applicantMap = new Map();

    for (const confirmation of confirmations) {
      const applicant: any = confirmation.applicants;
      if (!applicant) continue;

      if (!applicantMap.has(applicant.id)) {
        applicantMap.set(applicant.id, {
          ...applicant,
          confirmed_dates: [],
          line_sent_at: null,
          email_sent_at: null,
        });
      }

      const applicantData: any = applicantMap.get(applicant.id);

      // 日程情報を追加
      const dateInfo = dates.find((d) => d.id === confirmation.confirmed_date_id);

      // コース情報を取得
      let courseName = null;
      if (confirmation.confirmed_course_id) {
        const { data: course } = await supabaseAdmin
          .from('event_courses')
          .select('name')
          .eq('id', confirmation.confirmed_course_id)
          .single();
        courseName = course?.name || null;
      }

      applicantData.confirmed_dates.push({
        date_id: confirmation.confirmed_date_id,
        date: dateInfo?.date || null,
        course_id: confirmation.confirmed_course_id,
        course_name: courseName,
        confirmed_at: confirmation.confirmed_at,
      });
    }

    // 通知履歴を取得
    const applicantIds = Array.from(applicantMap.keys());
    for (const applicantId of applicantIds) {
      const applicantData: any = applicantMap.get(applicantId);

      // LINE通知履歴（最新のみ）
      const { data: lineNotification } = await supabaseAdmin
        .from('notification_logs')
        .select('sent_at')
        .eq('applicant_id', applicantId)
        .eq('notification_type', 'line')
        .eq('status', 'success')
        .order('sent_at', { ascending: false })
        .limit(1)
        .single();

      // メール通知履歴（最新のみ）
      const { data: emailNotification } = await supabaseAdmin
        .from('notification_logs')
        .select('sent_at')
        .eq('applicant_id', applicantId)
        .eq('notification_type', 'email')
        .eq('status', 'success')
        .order('sent_at', { ascending: false })
        .limit(1)
        .single();

      applicantData.line_sent_at = lineNotification?.sent_at || null;
      applicantData.email_sent_at = emailNotification?.sent_at || null;
    }

    // 配列に変換して返す
    const result = Array.from(applicantMap.values());

    return NextResponse.json(result);
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
      .select('id, name, line_user_id')
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

      // 確定参加情報を取得
      const { data: confirmations } = await supabaseAdmin
        .from('confirmed_participations')
        .select('confirmed_date_id, confirmed_course_id')
        .eq('applicant_id', applicant.id);

      if (!confirmations || confirmations.length === 0) {
        results.push({
          applicant_id: applicant.id,
          name: applicant.name,
          success: false,
          error: '確定情報なし',
        });
        continue;
      }

      // 各確定日程の情報を取得
      let messageText = `【参加確定のお知らせ】

${applicant.name} 様

オープンキャンパスへのお申し込みが確定しました。

`;

      // イベント情報を取得（最初の日程から）
      const firstConfirmation = confirmations[0];
      const { data: dateInfo } = await supabaseAdmin
        .from('open_campus_dates')
        .select('date, event_id')
        .eq('id', firstConfirmation.confirmed_date_id)
        .single();

      const { data: eventInfo } = await supabaseAdmin
        .from('open_campus_events')
        .select('name, confirmation_message')
        .eq('id', dateInfo?.event_id)
        .single();

      messageText += `■ イベント名
${eventInfo?.name || '不明'}

`;

      // 各確定日程を追加
      for (let i = 0; i < confirmations.length; i++) {
        const confirmation = confirmations[i];

        const { data: date } = await supabaseAdmin
          .from('open_campus_dates')
          .select('date')
          .eq('id', confirmation.confirmed_date_id)
          .single();

        let courseName = 'なし';
        if (confirmation.confirmed_course_id) {
          const { data: course } = await supabaseAdmin
            .from('event_courses')
            .select('name')
            .eq('id', confirmation.confirmed_course_id)
            .single();
          courseName = course?.name || 'なし';
        }

        if (confirmations.length > 1) {
          messageText += `■ 参加日時${i + 1}
`;
        } else {
          messageText += `■ 参加日時
`;
        }

        messageText += `${date ? new Date(date.date).toLocaleDateString('ja-JP', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long',
        }) : '不明'}

■ 参加コース
${courseName}

`;
      }

      // 確定者案内メッセージを追加
      if (eventInfo?.confirmation_message) {
        messageText += `■ 当日のご案内
${eventInfo.confirmation_message}

`;
      }

      messageText += `当日お会いできることを楽しみにしております。

※このメッセージは自動送信されています。`;

      const message = {
        type: 'text',
        text: messageText,
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
          // 通知履歴を記録
          await supabaseAdmin.from('notification_logs').insert({
            applicant_id: applicant.id,
            notification_type: 'line',
            status: 'success',
          });

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

// メール通知送信
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { applicant_ids } = body;

    if (!applicant_ids || !Array.isArray(applicant_ids) || applicant_ids.length === 0) {
      return NextResponse.json(
        { error: '送信対象の申込者IDが必要です' },
        { status: 400 }
      );
    }

    // メール設定を取得
    const { data: emailSettings } = await supabaseAdmin
      .from('email_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (!emailSettings) {
      return NextResponse.json(
        { error: 'メールサーバ設定が登録されていません' },
        { status: 400 }
      );
    }

    // 申込者情報を取得
    const { data: applicants } = await supabaseAdmin
      .from('applicants')
      .select('id, name, email')
      .in('id', applicant_ids);

    if (!applicants || applicants.length === 0) {
      return NextResponse.json(
        { error: '対象の申込者が見つかりません' },
        { status: 404 }
      );
    }

    // nodemailer を使用してメール送信
    const nodemailer = require('nodemailer');

    const transporter = nodemailer.createTransport({
      host: emailSettings.smtp_host,
      port: emailSettings.smtp_port,
      secure: emailSettings.smtp_port === 465,
      auth: {
        user: emailSettings.smtp_user,
        pass: emailSettings.smtp_password,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const results = [];

    for (const applicant of applicants) {
      // 確定参加情報を取得
      const { data: confirmations } = await supabaseAdmin
        .from('confirmed_participations')
        .select('confirmed_date_id, confirmed_course_id')
        .eq('applicant_id', applicant.id);

      if (!confirmations || confirmations.length === 0) {
        results.push({
          applicant_id: applicant.id,
          name: applicant.name,
          email: applicant.email,
          success: false,
          error: '確定情報なし',
        });
        continue;
      }

      // イベント情報を取得
      const firstConfirmation = confirmations[0];
      const { data: dateInfo } = await supabaseAdmin
        .from('open_campus_dates')
        .select('date, event_id')
        .eq('id', firstConfirmation.confirmed_date_id)
        .single();

      const { data: eventInfo } = await supabaseAdmin
        .from('open_campus_events')
        .select('name, confirmation_message')
        .eq('id', dateInfo?.event_id)
        .single();

      // メール本文を作成
      let htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
            【参加確定のお知らせ】
          </h2>

          <p>${applicant.name} 様</p>

          <p>オープンキャンパスへのお申し込みが確定しました。</p>

          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1f2937;">■ イベント名</h3>
            <p style="font-size: 16px; margin: 5px 0;">${eventInfo?.name || '不明'}</p>
`;

      // 各確定日程を追加
      for (let i = 0; i < confirmations.length; i++) {
        const confirmation = confirmations[i];

        const { data: date } = await supabaseAdmin
          .from('open_campus_dates')
          .select('date')
          .eq('id', confirmation.confirmed_date_id)
          .single();

        let courseName = 'なし';
        if (confirmation.confirmed_course_id) {
          const { data: course } = await supabaseAdmin
            .from('event_courses')
            .select('name')
            .eq('id', confirmation.confirmed_course_id)
            .single();
          courseName = course?.name || 'なし';
        }

        const dateFormatted = date
          ? new Date(date.date).toLocaleDateString('ja-JP', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })
          : '不明';

        htmlContent += `
            <h3 style="color: #1f2937;">■ 参加日時${confirmations.length > 1 ? i + 1 : ''}</h3>
            <p style="font-size: 16px; margin: 5px 0;">${dateFormatted}</p>

            <h3 style="color: #1f2937;">■ 参加コース</h3>
            <p style="font-size: 16px; margin: 5px 0;">${courseName}</p>
`;
      }

      // 確定者案内メッセージを追加
      if (eventInfo?.confirmation_message) {
        htmlContent += `
            <h3 style="color: #1f2937;">■ 当日のご案内</h3>
            <p style="font-size: 16px; margin: 5px 0; white-space: pre-wrap;">${eventInfo.confirmation_message}</p>`;
      }

      htmlContent += `
          </div>

          <p>当日お会いできることを楽しみにしております。</p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

          <p style="color: #6b7280; font-size: 12px;">
            ※このメールは自動送信されています。<br>
            ご不明な点がございましたら、お問い合わせください。
          </p>
        </div>
      `;

      // テキスト版メール本文
      let textContent = `【参加確定のお知らせ】

${applicant.name} 様

オープンキャンパスへのお申し込みが確定しました。

■ イベント名
${eventInfo?.name || '不明'}

`;

      for (let i = 0; i < confirmations.length; i++) {
        const confirmation = confirmations[i];

        const { data: date } = await supabaseAdmin
          .from('open_campus_dates')
          .select('date')
          .eq('id', confirmation.confirmed_date_id)
          .single();

        let courseName = 'なし';
        if (confirmation.confirmed_course_id) {
          const { data: course } = await supabaseAdmin
            .from('event_courses')
            .select('name')
            .eq('id', confirmation.confirmed_course_id)
            .single();
          courseName = course?.name || 'なし';
        }

        const dateFormatted = date
          ? new Date(date.date).toLocaleDateString('ja-JP', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })
          : '不明';

        textContent += `■ 参加日時${confirmations.length > 1 ? i + 1 : ''}
${dateFormatted}

■ 参加コース
${courseName}

`;
      }

      if (eventInfo?.confirmation_message) {
        textContent += `■ 当日のご案内
${eventInfo.confirmation_message}

`;
      }

      textContent += `当日お会いできることを楽しみにしております。

※このメールは自動送信されています。`;

      try {
        await transporter.sendMail({
          from: emailSettings.from_name
            ? `"${emailSettings.from_name}" <${emailSettings.from_email}>`
            : emailSettings.from_email,
          to: applicant.email,
          subject: `【参加確定】オープンキャンパスのお知らせ - ${eventInfo?.name || ''}`,
          text: textContent,
          html: htmlContent,
        });

        // 通知履歴を記録
        await supabaseAdmin.from('notification_logs').insert({
          applicant_id: applicant.id,
          notification_type: 'email',
          status: 'success',
        });

        results.push({
          applicant_id: applicant.id,
          name: applicant.name,
          email: applicant.email,
          success: true,
        });
      } catch (error: any) {
        console.error(`メール送信失敗 (${applicant.name}):`, error);

        // 失敗を記録
        await supabaseAdmin.from('notification_logs').insert({
          applicant_id: applicant.id,
          notification_type: 'email',
          status: 'failed',
          error_message: error.message,
        });

        results.push({
          applicant_id: applicant.id,
          name: applicant.name,
          email: applicant.email,
          success: false,
          error: error.message,
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
