/**
 * Next.js Middleware
 * テナント解決・認証チェック
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 有効なテナントslugリスト（静的チェック用。DB確認はAPI/ページ側で行う）
const VALID_TENANT_SLUGS = ['ise-hoken', 'ise-gakuen'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({
    request,
  });

  // テナントslugを抽出
  const pathSegments = pathname.split('/').filter(Boolean);
  const tenantSlug = pathSegments[0];

  // テナントパスでない場合はそのまま通す
  if (!tenantSlug || !VALID_TENANT_SLUGS.includes(tenantSlug)) {
    // /api/line/webhook はテナントプレフィックスなしで動作
    // ルートページ（テナント選択画面）、静的アセット等もそのまま
    return response;
  }

  // テナントslugをヘッダーにセット
  response = NextResponse.next({
    request: {
      headers: new Headers(request.headers),
    },
  });
  response.headers.set('x-tenant-slug', tenantSlug);

  // Supabaseクライアント作成（セッションリフレッシュ用）
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          response.headers.set('x-tenant-slug', tenantSlug);
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // セッションをリフレッシュ
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // 管理画面へのアクセス（/[tenant]/admin/...）
  const isAdminPath = pathSegments[1] === 'admin';
  const isAdminLoginPath = pathSegments[1] === 'admin' && pathSegments[2] === 'login';

  if (isAdminPath) {
    // ログインページとAPI以外は認証が必要
    if (!isAdminLoginPath && !pathname.startsWith('/api/')) {
      if (!session) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = `/${tenantSlug}/admin/login`;
        redirectUrl.searchParams.set('redirectTo', pathname);
        return NextResponse.redirect(redirectUrl);
      }
    }

    // ログイン済みでログインページにアクセスした場合はイベント一覧へ
    if (isAdminLoginPath && session) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `/${tenantSlug}/admin/events`;
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

// ミドルウェアを適用するパス
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
