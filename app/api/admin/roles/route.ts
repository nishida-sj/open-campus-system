import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUserFromRequest, ROLE_LEVELS } from '@/lib/auth';

// ロール一覧取得
export async function GET() {
  try {
    // 権限チェック：スーパー管理者のみ
    const currentUser = await getCurrentUserFromRequest();
    console.log('[DEBUG] GET /api/admin/roles - Current user:', {
      exists: !!currentUser,
      email: currentUser?.email,
      max_role_level: currentUser?.max_role_level,
      required_level: ROLE_LEVELS.SUPER_ADMIN,
      is_active: currentUser?.is_active,
    });

    if (!currentUser || currentUser.max_role_level < ROLE_LEVELS.SUPER_ADMIN) {
      console.log('[DEBUG] Access denied - insufficient permissions');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // ロール一覧を取得
    const { data: roles, error } = await supabaseAdmin
      .from('roles')
      .select('*')
      .order('level', { ascending: false });

    if (error) {
      console.error('Roles fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch roles' },
        { status: 500 }
      );
    }

    return NextResponse.json({ roles });
  } catch (error) {
    console.error('GET /api/admin/roles error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
