/**
 * 認証ヘルパー関数
 * サーバーサイドでの認証チェックとユーザー情報取得
 */

import { createServerClient } from '@supabase/ssr';
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
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Server Component内では set は呼ばれないため無視
            }
          },
        },
      }
    );

    // Supabase Authからユーザー情報を取得（セキュアな方法）
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('[Auth] User auth error:', authError);
      return null;
    }

    if (!authUser) {
      console.log('[Auth] No authenticated user found');
      return null;
    }

    console.log('[Auth] Authenticated user:', authUser.email);

    // データベースからユーザー情報とロールを取得
    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from('users_with_roles')
      .select('*')
      .eq('email', authUser.email)
      .single();

    if (dbError) {
      console.error('[Auth] User fetch error:', dbError);
      return null;
    }

    if (!dbUser) {
      console.error('[Auth] User not found for email:', authUser.email);
      return null;
    }

    console.log('[Auth] User found:', {
      email: dbUser.email,
      max_role_level: dbUser.max_role_level,
      roles: dbUser.roles
    });

    // アクティブでないユーザーは拒否
    if (!dbUser.is_active) {
      console.warn('[Auth] User is not active:', dbUser.email);
      return null;
    }

    return dbUser as UserWithRoles;
  } catch (error) {
    console.error('[Auth] getCurrentUser error:', error);
    return null;
  }
}

/**
 * API Route用: Route Handlerから認証情報を取得
 */
export async function getCurrentUserFromRequest(): Promise<UserWithRoles | null> {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Route Handler内でもsetは使用可能
            }
          },
        },
      }
    );

    // Supabase Authからユーザー情報を取得（セキュアな方法）
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('[Auth API] User auth error:', authError);
      return null;
    }

    if (!authUser) {
      console.log('[Auth API] No authenticated user found');
      return null;
    }

    console.log('[Auth API] Authenticated user:', authUser.email);

    // データベースからユーザー情報とロールを取得
    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from('users_with_roles')
      .select('*')
      .eq('email', authUser.email)
      .single();

    if (dbError) {
      console.error('[Auth API] User fetch error:', dbError);
      return null;
    }

    if (!dbUser) {
      console.error('[Auth API] User not found for email:', authUser.email);
      return null;
    }

    console.log('[Auth API] User found:', {
      email: dbUser.email,
      max_role_level: dbUser.max_role_level,
      roles: dbUser.roles
    });

    // アクティブでないユーザーは拒否
    if (!dbUser.is_active) {
      console.warn('[Auth API] User is not active:', dbUser.email);
      return null;
    }

    return dbUser as UserWithRoles;
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
    console.log('[logLogin] Starting login logging:', { email, success });

    // ユーザーIDを取得
    let userId: string | null = null;
    if (success) {
      const { data, error: userError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (userError) {
        console.error('[logLogin] Failed to fetch user ID:', userError);
      }

      userId = data?.id || null;
      console.log('[logLogin] User ID:', userId);

      // ログイン成功時はlast_login_atを更新
      if (userId) {
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', userId);

        if (updateError) {
          console.error('[logLogin] Failed to update last_login_at:', updateError);
        } else {
          console.log('[logLogin] Updated last_login_at for user:', userId);
        }
      }
    }

    // ログイン履歴を記録
    const logData = {
      user_id: userId,
      email,
      success,
      ip_address: ipAddress,
      user_agent: userAgent,
      failure_reason: failureReason,
      session_id: sessionId,
    };

    console.log('[logLogin] Inserting log entry:', logData);

    const { error: insertError } = await supabaseAdmin
      .from('login_logs')
      .insert(logData);

    if (insertError) {
      console.error('[logLogin] Failed to insert login log:', insertError);
    } else {
      console.log('[logLogin] Successfully inserted login log');
    }
  } catch (error) {
    console.error('[logLogin] Failed to log login:', error);
  }
}
