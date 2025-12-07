/**
 * 認証ヘルパー関数
 * サーバーサイドでの認証チェックとユーザー情報取得
 */

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { supabaseAdmin } from './supabase';

export interface UserWithRoles {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  roles: {
    role_id: string;
    role_name: string;
    display_name: string;
    level: number;
    assigned_at: string;
  }[];
  max_role_level: number;
}

/**
 * 現在ログイン中のユーザー情報を取得（ロール情報含む）
 * Server Component用
 */
export async function getCurrentUser(): Promise<UserWithRoles | null> {
  try {
    const supabase = createServerComponentClient({ cookies });

    // Supabase Authからセッションを取得
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('[Auth] Session error:', sessionError);
      return null;
    }

    if (!session) {
      console.log('[Auth] No session found');
      return null;
    }

    console.log('[Auth] Session found for:', session.user.email);

    // データベースからユーザー情報とロールを取得
    const { data: user, error: userError } = await supabaseAdmin
      .from('users_with_roles')
      .select('*')
      .eq('email', session.user.email)
      .single();

    if (userError) {
      console.error('[Auth] User fetch error:', userError);
      return null;
    }

    if (!user) {
      console.error('[Auth] User not found for email:', session.user.email);
      return null;
    }

    console.log('[Auth] User found:', {
      email: user.email,
      max_role_level: user.max_role_level,
      roles: user.roles
    });

    // アクティブでないユーザーは拒否
    if (!user.is_active) {
      console.warn('[Auth] User is not active:', user.email);
      return null;
    }

    return user as UserWithRoles;
  } catch (error) {
    console.error('[Auth] getCurrentUser error:', error);
    return null;
  }
}

/**
 * API Route用: Requestオブジェクトから認証情報を取得
 */
export async function getCurrentUserFromRequest(request: Request): Promise<UserWithRoles | null> {
  try {
    // Requestからcookieヘッダーを取得
    const cookieHeader = request.headers.get('cookie') || '';

    console.log('[Auth API] Cookie header present:', !!cookieHeader);

    // supabase-auth-tokenを抽出
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    const accessToken = cookies['sb-access-token'] ||
                       cookies['sb-localhost-auth-token'] ||
                       cookies['supabase-auth-token'];

    if (!accessToken) {
      console.log('[Auth API] No access token found in cookies');
      return null;
    }

    console.log('[Auth API] Access token found');

    // アクセストークンからユーザー情報を取得
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(accessToken);

    if (authError || !authUser) {
      console.error('[Auth API] Auth error:', authError);
      return null;
    }

    console.log('[Auth API] Auth user found:', authUser.email);

    // データベースからユーザー情報とロールを取得
    const { data: user, error: userError } = await supabaseAdmin
      .from('users_with_roles')
      .select('*')
      .eq('email', authUser.email)
      .single();

    if (userError) {
      console.error('[Auth API] User fetch error:', userError);
      return null;
    }

    if (!user) {
      console.error('[Auth API] User not found for email:', authUser.email);
      return null;
    }

    console.log('[Auth API] User found:', {
      email: user.email,
      max_role_level: user.max_role_level,
      roles: user.roles
    });

    // アクティブでないユーザーは拒否
    if (!user.is_active) {
      console.warn('[Auth API] User is not active:', user.email);
      return null;
    }

    return user as UserWithRoles;
  } catch (error) {
    console.error('[Auth API] getCurrentUserFromRequest error:', error);
    return null;
  }
}

/**
 * ユーザーが指定したロールを持っているかチェック
 */
export async function hasRole(roleName: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  return user.roles.some(role => role.role_name === roleName);
}

/**
 * ユーザーが最低限必要な権限レベルを持っているかチェック
 */
export async function hasMinimumLevel(minimumLevel: number): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  return user.max_role_level >= minimumLevel;
}

/**
 * 権限レベル定義
 */
export const ROLE_LEVELS = {
  SUPER_ADMIN: 100,  // スーパー管理者
  LINE_ADMIN: 50,    // LINEビジネス管理者
  EVENT_STAFF: 30,   // オープンキャンパス担当者
} as const;

/**
 * ロール名定義
 */
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  LINE_ADMIN: 'line_admin',
  EVENT_STAFF: 'event_staff',
} as const;

/**
 * ページアクセス権限チェック
 * 各ページで必要な最低権限レベルを定義
 */
export const PAGE_PERMISSIONS = {
  // ユーザー管理 - スーパー管理者のみ
  '/admin/users': ROLE_LEVELS.SUPER_ADMIN,

  // AI設定 - スーパー管理者またはLINE管理者
  '/admin/ai-settings': ROLE_LEVELS.LINE_ADMIN,

  // イベント管理 - オープンキャンパス担当者以上
  '/admin/events': ROLE_LEVELS.EVENT_STAFF,

  // 申込者管理 - オープンキャンパス担当者以上
  '/admin/applicants': ROLE_LEVELS.EVENT_STAFF,

  // 配信管理 - LINEビジネス管理者以上
  '/admin/broadcast': ROLE_LEVELS.LINE_ADMIN,

  // ログイン履歴 - スーパー管理者のみ
  '/admin/login-logs': ROLE_LEVELS.SUPER_ADMIN,
} as const;

/**
 * 指定したパスへのアクセス権限があるかチェック
 */
export async function canAccessPath(path: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  // パスに対応する必要権限レベルを取得
  const requiredLevel = PAGE_PERMISSIONS[path as keyof typeof PAGE_PERMISSIONS];

  // 定義されていないパスはデフォルトで許可
  if (requiredLevel === undefined) {
    return true;
  }

  // ユーザーの最高権限レベルが必要レベル以上かチェック
  return user.max_role_level >= requiredLevel;
}

/**
 * ログイン履歴を記録
 */
export async function logLogin(
  email: string,
  success: boolean,
  ipAddress?: string,
  userAgent?: string,
  failureReason?: string,
  sessionId?: string
): Promise<void> {
  try {
    // ユーザーIDを取得
    let userId: string | null = null;
    if (success) {
      const { data } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      userId = data?.id || null;

      // ログイン成功時はlast_login_atを更新
      if (userId) {
        await supabaseAdmin
          .from('users')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', userId);
      }
    }

    // ログイン履歴を記録
    await supabaseAdmin
      .from('login_logs')
      .insert({
        user_id: userId,
        email,
        success,
        ip_address: ipAddress,
        user_agent: userAgent,
        failure_reason: failureReason,
        session_id: sessionId,
      });
  } catch (error) {
    console.error('Failed to log login:', error);
  }
}
