import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUser, ROLE_LEVELS } from '@/lib/auth';

export async function GET() {
  try {
    // 権限チェック：スーパー管理者のみ
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.max_role_level < ROLE_LEVELS.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // ログイン履歴を取得（最新100件）
    const { data: logs, error } = await supabaseAdmin
      .from('login_logs')
      .select('*')
      .order('login_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Login logs fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch login logs' },
        { status: 500 }
      );
    }

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('GET /api/admin/login-logs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
