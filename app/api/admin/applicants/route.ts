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

// 申込者の一括削除
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { applicant_ids } = body;

    if (!applicant_ids || !Array.isArray(applicant_ids) || applicant_ids.length === 0) {
      return NextResponse.json(
        { error: '削除する申込者IDが必要です' },
        { status: 400 }
      );
    }

    // 削除ログを記録
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || '';

    for (const applicantId of applicant_ids) {
      await supabaseAdmin.from('application_logs').insert({
        applicant_id: applicantId,
        action: 'deleted',
        ip_address: ipAddress,
        user_agent: userAgent,
      });
    }

    // 申込者を削除（関連データはカスケード削除される）
    const { error: deleteError } = await supabaseAdmin
      .from('applicants')
      .delete()
      .in('id', applicant_ids);

    if (deleteError) {
      console.error('削除エラー:', deleteError);
      return NextResponse.json(
        { error: '削除に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deleted_count: applicant_ids.length
    });
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
