import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// イベント一覧取得
export async function GET() {
  try {
    const { data: events, error } = await supabaseAdmin
      .from('open_campus_events')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('イベント取得エラー:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(events || []);
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// イベント作成
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, max_date_selections, is_active, dates } = body;

    // バリデーション
    if (!name || !dates || dates.length === 0) {
      return NextResponse.json(
        { error: 'イベント名と開催日程を入力してください' },
        { status: 400 }
      );
    }

    // 日程データのバリデーション
    for (const date of dates) {
      if (!date.date || !date.capacity || date.capacity < 1) {
        return NextResponse.json(
          { error: '開催日と定員を正しく入力してください' },
          { status: 400 }
        );
      }
    }

    // イベント作成
    const { data: event, error: eventError } = await supabaseAdmin
      .from('open_campus_events')
      .insert({
        name,
        description: description || null,
        max_date_selections: max_date_selections || 1,
        is_active: is_active !== undefined ? is_active : true,
      })
      .select()
      .single();

    if (eventError) {
      console.error('イベント作成エラー:', eventError);
      return NextResponse.json({ error: eventError.message }, { status: 500 });
    }

    // 開催日程を作成
    const datesToInsert = dates.map((d: { date: string; capacity: number }) => ({
      event_id: event.id,
      date: d.date,
      capacity: d.capacity,
      current_count: 0,
      is_active: true,
    }));

    const { error: datesError } = await supabaseAdmin
      .from('open_campus_dates')
      .insert(datesToInsert);

    if (datesError) {
      console.error('日程作成エラー:', datesError);
      // イベントは作成されたが日程作成に失敗した場合、イベントを削除
      await supabaseAdmin.from('open_campus_events').delete().eq('id', event.id);
      return NextResponse.json({ error: '開催日程の作成に失敗しました' }, { status: 500 });
    }

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
