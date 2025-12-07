import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUserFromRequest, ROLE_LEVELS } from '@/lib/auth';

export async function GET() {
  try {
    // 権限チェック：スーパー管理者のみ
    const currentUser = await getCurrentUserFromRequest();
    console.log('[DEBUG] GET /api/admin/login-logs - Current user:', {
      exists: !!currentUser,
      email: currentUser?.email,
      max_role_level: currentUser?.max_role_level,
      required_level: ROLE_LEVELS.SUPER_ADMIN,
      is_active: currentUser?.is_active,
    });

    if (!currentUser || currentUser.max_role_level < ROLE_LEVELS.SUPER_ADMIN) {
      console.log('[DEBUG] Access denied - insufficient permissions');
      return NextResponse.json(
        {
          error: 'Unauthorized',
          debug: {
            userExists: !!currentUser,
            email: currentUser?.email || 'N/A',
            maxRoleLevel: currentUser?.max_role_level || 'N/A',
            requiredLevel: ROLE_LEVELS.SUPER_ADMIN,
            isActive: currentUser?.is_active || 'N/A',
          }
        },
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

    console.log('[DEBUG] Successfully fetched login logs:', {
      count: logs?.length || 0,
      firstLog: logs?.[0] || null,
    });

    return NextResponse.json({ logs: logs || [] });
  } catch (error) {
    console.error('GET /api/admin/login-logs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
