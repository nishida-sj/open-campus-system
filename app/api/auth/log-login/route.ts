import { NextResponse } from 'next/server';
import { logLogin } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, success, failure_reason, session_id } = body;

    if (!email || success === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // IPアドレスとUser-Agentを取得
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // ログイン履歴を記録
    await logLogin(email, success, ip, userAgent, failure_reason, session_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/auth/log-login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
