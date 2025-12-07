/**
 * Next.js Middleware
 * 認証チェックと権限チェックを実行
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
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

  // 管理画面へのアクセス
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // ログインページとAPI以外は認証が必要
    if (
      !request.nextUrl.pathname.startsWith('/admin/login') &&
      !request.nextUrl.pathname.startsWith('/api/')
    ) {
      // 未ログインの場合はログインページへリダイレクト
      if (!session) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = '/admin/login';
        redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname);
        return NextResponse.redirect(redirectUrl);
      }
    }

    // ログイン済みでログインページにアクセスした場合はダッシュボードへ
    if (request.nextUrl.pathname === '/admin/login' && session) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/admin/events';
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

// ミドルウェアを適用するパス
export const config = {
  matcher: [
    '/admin/:path*',
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
