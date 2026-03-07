/**
 * 未回答質問ログAPI（テナント対応版）
 * GET: 一覧取得（format=csv でCSVダウンロード対応）
 * DELETE: 個別削除
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getTenantBySlug } from '@/lib/tenant';

// GET: 未回答質問一覧を取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: slug } = await params;
    const tenant = await getTenantBySlug(slug);
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('unanswered_questions')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Failed to fetch unanswered questions:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch unanswered questions' },
        { status: 500 }
      );
    }

    // CSV出力
    const { searchParams } = new URL(request.url);
    if (searchParams.get('format') === 'csv') {
      const bom = '\uFEFF';
      const header = '日時,ユーザーID,質問内容,AI応答';
      const rows = (data || []).map((q) => {
        const date = new Date(q.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
        const escape = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
        return `${escape(date)},${escape(q.line_user_id)},${escape(q.user_message)},${escape(q.ai_response || '')}`;
      });
      const csv = bom + header + '\n' + rows.join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="unanswered_questions_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({ success: true, questions: data || [] });
  } catch (error) {
    console.error('GET /api/[tenant]/admin/unanswered-questions error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: 個別削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: slug } = await params;
    const tenant = await getTenantBySlug(slug);
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('unanswered_questions')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenant.id);

    if (error) {
      console.error('Failed to delete unanswered question:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/[tenant]/admin/unanswered-questions error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
