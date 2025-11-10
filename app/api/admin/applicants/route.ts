import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    // applicantsテーブルから全レコードを取得
    // created_at降順（新しい順）でソート
    const { data: applicants, error } = await supabaseAdmin
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
        interested_course_id,
        visit_date_id,
        guardian_attendance,
        guardian_name,
        guardian_phone,
        remarks,
        line_user_id,
        status,
        created_at
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: '申込者一覧の取得に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json(applicants || []);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
