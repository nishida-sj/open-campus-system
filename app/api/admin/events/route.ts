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
    const { name, description, max_date_selections, is_active, selectedDates } = body;

    // バリデーション
    if (!name || !selectedDates || selectedDates.length === 0) {
      return NextResponse.json(
        { error: 'イベント名と日程を選択してください' },
        { status: 400 }
      );
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

    // 選択された日程にevent_idを設定
    const { error: updateError } = await supabaseAdmin
      .from('open_campus_dates')
      .update({ event_id: event.id })
      .in('id', selectedDates);

    if (updateError) {
      console.error('日程更新エラー:', updateError);
      // イベントは作成されたが日程紐付けに失敗した場合、イベントを削除
      await supabaseAdmin.from('open_campus_events').delete().eq('id', event.id);
      return NextResponse.json({ error: '日程の紐付けに失敗しました' }, { status: 500 });
    }

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
