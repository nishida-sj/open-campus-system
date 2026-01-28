/**
 * テスター招待コード管理API
 * GET: 現在のコード情報取得
 * POST: 新しいコードを発行
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateTesterInviteCode, getInviteCodeInfo } from '@/lib/usage-monitor';

// GET: 現在の招待コード情報を取得
export async function GET() {
  try {
    const info = await getInviteCodeInfo();
    return NextResponse.json({
      success: true,
      ...info,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/maintenance-invite:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get invite code info' },
      { status: 500 }
    );
  }
}

// POST: 新しい招待コードを発行
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const expiresInMinutes = body.expiresInMinutes || 10;

    const code = await generateTesterInviteCode(expiresInMinutes);

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate invite code' },
        { status: 500 }
      );
    }

    const info = await getInviteCodeInfo();

    return NextResponse.json({
      success: true,
      code,
      expiresAt: info.expiresAt,
      message: `招待コードを発行しました（${expiresInMinutes}分間有効）`,
    });
  } catch (error) {
    console.error('Error in POST /api/admin/maintenance-invite:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate invite code' },
      { status: 500 }
    );
  }
}
