import { NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/auth';

/**
 * 現在ログイン中のユーザー情報を取得
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUserFromRequest();

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    return NextResponse.json({ user: currentUser });
  } catch (error) {
    console.error('GET /api/admin/me error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
