/**
 * AI使用量取得API（テナント対応版）
 * GET: 今月の使用量統計を取得
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMonthlyUsage } from '@/lib/usage-monitor';
import { getTenantBySlug } from '@/lib/tenant';

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

    const usage = await getMonthlyUsage(tenant.id);

    return NextResponse.json({
      success: true,
      usage,
    });
  } catch (error) {
    console.error('Error in GET /api/[tenant]/admin/ai-usage:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch usage data',
      },
      { status: 500 }
    );
  }
}
