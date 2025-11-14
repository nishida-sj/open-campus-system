import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

interface CSVRow {
  applicant_id: string;
  name: string;
  email: string;
  confirmed_date: string;
  confirmed_course: string;
  confirm_flag: string;
}

// CSVインポート一括確定
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { csv_data, event_id } = body;

    if (!csv_data || !event_id) {
      return NextResponse.json(
        { error: 'csv_dataとevent_idが必要です' },
        { status: 400 }
      );
    }

    // CSVデータを解析
    const parseResult = parseCSV(csv_data);

    if (parseResult.error) {
      return NextResponse.json(
        { error: parseResult.error },
        { status: 400 }
      );
    }

    const rows: CSVRow[] = parseResult.rows;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'CSVデータが空です。ヘッダー行のみのCSVファイルです。' },
        { status: 400 }
      );
    }

    // バリデーション結果
    const validationResults: any[] = [];
    const successResults: any[] = [];
    const errorResults: any[] = [];

    // イベント情報を取得
    const { data: event } = await supabaseAdmin
      .from('open_campus_events')
      .select('id, name, allow_multiple_dates')
      .eq('id', event_id)
      .single();

    if (!event) {
      return NextResponse.json(
        { error: 'イベントが見つかりません' },
        { status: 404 }
      );
    }

    // イベントに紐づく日程を取得
    const { data: eventDates } = await supabaseAdmin
      .from('open_campus_dates')
      .select('id, date')
      .eq('event_id', event_id);

    if (!eventDates || eventDates.length === 0) {
      return NextResponse.json(
        { error: 'イベントに日程が登録されていません' },
        { status: 400 }
      );
    }

    // 日程の日付文字列からIDへのマップを作成
    const dateMap = new Map(
      eventDates.map((d) => [
        new Date(d.date).toLocaleDateString('ja-JP', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).replace(/\//g, '-'),
        d.id
      ])
    );

    // 各行を処理
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // ヘッダー行を除く

      // 確定フラグがない場合はスキップ
      if (!row.confirm_flag || row.confirm_flag.trim() !== '○') {
        validationResults.push({
          row: rowNumber,
          status: 'skipped',
          message: '確定フラグなし（スキップ）',
          data: row,
        });
        continue;
      }

      // 必須項目チェック
      if (!row.applicant_id || !row.confirmed_date) {
        errorResults.push({
          row: rowNumber,
          status: 'error',
          message: '申込者IDまたは確定日程が不足しています',
          data: row,
        });
        continue;
      }

      // 申込者が存在するか確認
      const { data: applicant } = await supabaseAdmin
        .from('applicants')
        .select('id, name, email')
        .eq('id', row.applicant_id)
        .single();

      if (!applicant) {
        errorResults.push({
          row: rowNumber,
          status: 'error',
          message: '申込者が見つかりません',
          data: row,
        });
        continue;
      }

      // 確定日程の日付文字列からIDを取得
      let confirmedDateId: string | undefined;

      // 日付形式を正規化（複数の形式に対応）
      let normalizedDate = row.confirmed_date
        .replace(/年/g, '-')
        .replace(/月/g, '-')
        .replace(/日/g, '')
        .replace(/\//g, '-')
        .trim();

      // YYYY-MM-DD形式に変換
      const dateMatch = normalizedDate.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (dateMatch) {
        const [, year, month, day] = dateMatch;
        normalizedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }

      // dateMapから検索
      for (const [dateStr, dateId] of dateMap.entries()) {
        if (normalizedDate === dateStr || normalizedDate.includes(dateStr) || dateStr.includes(normalizedDate)) {
          confirmedDateId = dateId;
          break;
        }
      }

      // 見つからない場合、イベント日程を直接検索
      if (!confirmedDateId) {
        for (const eventDate of eventDates) {
          const eventDateStr = new Date(eventDate.date).toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).replace(/\//g, '-');

          if (normalizedDate === eventDateStr) {
            confirmedDateId = eventDate.id;
            break;
          }
        }
      }

      if (!confirmedDateId) {
        errorResults.push({
          row: rowNumber,
          status: 'error',
          message: `確定日程が見つかりません: ${row.confirmed_date}（このイベントの日程ではありません）`,
          data: row,
        });
        continue;
      }

      // 選択日程に含まれているか確認
      const { data: visitDate } = await supabaseAdmin
        .from('applicant_visit_dates')
        .select('visit_date_id, selected_course_id')
        .eq('applicant_id', row.applicant_id)
        .eq('visit_date_id', confirmedDateId)
        .single();

      if (!visitDate) {
        errorResults.push({
          row: rowNumber,
          status: 'error',
          message: '選択されていない日程です',
          data: row,
        });
        continue;
      }

      // コースIDの取得（コース名から検索）
      let confirmedCourseId: string | null = null;
      if (row.confirmed_course && row.confirmed_course.trim()) {
        const { data: course } = await supabaseAdmin
          .from('event_courses')
          .select('id')
          .eq('event_id', event_id)
          .eq('name', row.confirmed_course.trim())
          .single();

        if (course) {
          confirmedCourseId = course.id;
        } else {
          // コースが見つからない場合は選択されたコースを使用
          confirmedCourseId = visitDate.selected_course_id;
        }
      } else {
        // コースが指定されていない場合は選択されたコースを使用
        confirmedCourseId = visitDate.selected_course_id;
      }

      // 既存の確定をチェック
      const { data: existingConfirmations } = await supabaseAdmin
        .from('confirmed_participations')
        .select('id, confirmed_date_id')
        .eq('applicant_id', row.applicant_id);

      // 複数日参加が許可されていない場合のチェック
      if (!event.allow_multiple_dates && existingConfirmations && existingConfirmations.length > 0) {
        const existingDate = existingConfirmations[0];
        if (existingDate.confirmed_date_id !== confirmedDateId) {
          errorResults.push({
            row: rowNumber,
            status: 'error',
            message: 'このイベントは複数日参加が許可されていません',
            data: row,
          });
          continue;
        }
      }

      // 同じ日程が既に確定されているかチェック
      const alreadyConfirmed = existingConfirmations?.find(
        (c: any) => c.confirmed_date_id === confirmedDateId
      );

      try {
        if (alreadyConfirmed) {
          // 既に確定済みの場合はコース情報のみ更新
          const { error: updateError } = await supabaseAdmin
            .from('confirmed_participations')
            .update({
              confirmed_course_id: confirmedCourseId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', alreadyConfirmed.id);

          if (updateError) {
            throw updateError;
          }

          successResults.push({
            row: rowNumber,
            status: 'updated',
            message: 'コース情報を更新しました',
            data: row,
          });
        } else {
          // 新規確定を作成
          const { error: insertError } = await supabaseAdmin
            .from('confirmed_participations')
            .insert({
              applicant_id: row.applicant_id,
              confirmed_date_id: confirmedDateId,
              confirmed_course_id: confirmedCourseId,
              confirmed_by: 'admin_csv',
            });

          if (insertError) {
            throw insertError;
          }

          // 申込者のステータスを確定に更新
          await supabaseAdmin
            .from('applicants')
            .update({ status: 'confirmed' })
            .eq('id', row.applicant_id);

          // 日程のカウントを増加
          await supabaseAdmin.rpc('increment_visit_count', {
            date_id: confirmedDateId,
          });

          successResults.push({
            row: rowNumber,
            status: 'created',
            message: '確定しました',
            data: row,
          });
        }
      } catch (error) {
        console.error(`行${rowNumber}の処理エラー:`, error);
        errorResults.push({
          row: rowNumber,
          status: 'error',
          message: `処理エラー: ${error}`,
          data: row,
        });
      }
    }

    return NextResponse.json({
      success: true,
      total: rows.length,
      succeeded: successResults.length,
      failed: errorResults.length,
      skipped: validationResults.length,
      results: {
        success: successResults,
        error: errorResults,
        skipped: validationResults,
      },
    });
  } catch (error) {
    console.error('一括確定エラー:', error);
    return NextResponse.json(
      { error: `サーバーエラー: ${error}` },
      { status: 500 }
    );
  }
}

// CSV文字列を解析
function parseCSV(csvText: string): { rows: CSVRow[]; error?: string } {
  const lines = csvText.split('\n').filter((line) => line.trim());

  if (lines.length < 1) {
    return { rows: [], error: 'CSVファイルが空です' };
  }

  if (lines.length < 2) {
    return { rows: [], error: 'CSVファイルにデータ行がありません（ヘッダーのみ）' };
  }

  // ヘッダー行の検証
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  const expectedHeaders = ['申込者ID', '氏名', 'ふりがな', '学校名', '学年', 'メールアドレス', '確定日程', '確定コース', '確定'];
  const hasValidHeaders = expectedHeaders.every((h, i) =>
    headers[i]?.includes(h) || h.includes(headers[i] || '')
  );

  if (!hasValidHeaders) {
    return {
      rows: [],
      error: `CSVヘッダーが正しくありません。期待: ${expectedHeaders.join(', ')}`
    };
  }

  // データ行をスキップ
  const dataLines = lines.slice(1);

  const rows: CSVRow[] = [];

  for (const line of dataLines) {
    // カンマで分割（ダブルクォートを考慮）
    const columns = parseCSVLine(line);

    if (columns.length < 9) {
      continue; // 列数が足りない行はスキップ
    }

    // 新しい列順序: 申込者ID, 氏名, ふりがな, 学校名, 学年, メールアドレス, 確定日程, 確定コース, 確定
    rows.push({
      applicant_id: columns[0]?.trim() || '',
      name: columns[1]?.trim() || '',
      email: columns[5]?.trim() || '', // メールアドレスは6列目
      confirmed_date: columns[6]?.trim() || '', // 確定日程は7列目
      confirmed_course: columns[7]?.trim() || '', // 確定コースは8列目
      confirm_flag: columns[8]?.trim() || '', // 確定は9列目
    });
  }

  return { rows };
}

// CSV行を解析（ダブルクォート対応）
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);

  return result.map((col) => col.replace(/^"|"$/g, '').trim());
}
