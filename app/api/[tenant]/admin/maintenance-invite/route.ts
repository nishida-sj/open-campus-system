/**
 * テスター招待コード管理API（テナント対応版）
 * GET: 現在のコード情報取得
 * POST: 新しいコードを発行
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateTesterInviteCode, getInviteCodeInfo } from '@/lib/usage-monitor';
import { getTenantBySlug } from '@/lib/tenant';

// GET: 現在の招待コード情報を取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: slug } = await params;
    const tenant = await getTenantBySlug(slug);
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    const info = await getInviteCodeInfo(tenant.id);
    return NextResponse.json({
      success: true,
      ...info,
    });
  } catch (error) {
    console.error('Error in GET /api/[tenant]/admin/maintenance-invite:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get invite code info' },
      { status: 500 }
    );
  }
}

// POST: 新しい招待コードを発行
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: slug } = await params;
    const tenant = await getTenantBySlug(slug);
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const expiresInMinutes = body.expiresInMinutes || 10;

    const code = await generateTesterInviteCode(expiresInMinutes, tenant.id);

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate invite code' },
        { status: 500 }
      );
    }

    const info = await getInviteCodeInfo(tenant.id);

    return NextResponse.json({
      success: true,
      code,
      expiresAt: info.expiresAt,
      message: `招待コードを発行しました（${expiresInMinutes}分間有効）`,
    });
  } catch (error) {
    console.error('Error in POST /api/[tenant]/admin/maintenance-invite:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate invite code' },
      { status: 500 }
    );
  }
}
