import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUserFromRequest, ROLE_LEVELS } from '@/lib/auth';

// ユーザー一覧取得
export async function GET() {
  try {
    // 権限チェック：スーパー管理者のみ
    const currentUser = await getCurrentUserFromRequest();
    console.log('[DEBUG] GET /api/admin/users - Current user:', {
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

    // ユーザー一覧を取得（ロール情報付き）
    const { data: users, error } = await supabaseAdmin
      .from('users_with_roles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Users fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    return NextResponse.json({ users });
  } catch (error) {
    console.error('GET /api/admin/users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ユーザー作成
export async function POST(request: Request) {
  try {
    // 権限チェック：スーパー管理者のみ
    const currentUser = await getCurrentUserFromRequest();
    if (!currentUser || currentUser.max_role_level < ROLE_LEVELS.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, password, full_name, role_ids, is_active } = body;

    // バリデーション
    if (!email || !password || !full_name || !role_ids || role_ids.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Supabase Authでユーザー作成
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error('Auth user creation error:', authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    // usersテーブルにユーザー情報を追加
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        full_name,
        is_active: is_active !== undefined ? is_active : true,
      });

    if (userError) {
      console.error('User creation error:', userError);
      // Auth ユーザーは作成されたが、users テーブルへの挿入に失敗した場合は Auth ユーザーを削除
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: userError.message },
        { status: 500 }
      );
    }

    // ロールを割り当て
    const userRoles = role_ids.map((role_id: string) => ({
      user_id: authData.user.id,
      role_id,
    }));

    const { error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .insert(userRoles);

    if (rolesError) {
      console.error('User roles assignment error:', rolesError);
      return NextResponse.json(
        { error: rolesError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: { id: authData.user.id, email, full_name }
    });
  } catch (error) {
    console.error('POST /api/admin/users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
