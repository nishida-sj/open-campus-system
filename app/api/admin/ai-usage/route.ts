/**
 * AI使用量取得API
 * GET: 今月の使用量統計を取得
 */

import { NextResponse } from 'next/server';
import { getMonthlyUsage } from '@/lib/usage-monitor';

export async function GET() {
  try {
    const usage = await getMonthlyUsage();

    return NextResponse.json({
      success: true,
      usage,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/ai-usage:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch usage data',
      },
      { status: 500 }
    );
  }
}
