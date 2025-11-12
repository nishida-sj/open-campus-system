import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: history, error } = await supabaseAdmin
      .from('broadcast_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('履歴取得エラー:', error);
      return NextResponse.json({ error: '履歴の取得に失敗しました' }, { status: 500 });
    }

    return NextResponse.json(history || []);
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
