import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getTenantBySlug } from '@/lib/tenant';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: slug } = await params;
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const today = new Date().toISOString().split('T')[0];

    const { data: dates, error } = await supabaseAdmin
      .from('open_campus_dates')
      .select('id, date, capacity, current_count, is_active')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .gte('date', today)
      .order('date', { ascending: true });

    if (error) {
      return NextResponse.json({ error: '開催日程の取得に失敗しました' }, { status: 500 });
    }

    const datesWithRemaining = (dates || []).map(date => ({
      ...date,
      remaining: date.capacity - date.current_count
    }));

    return NextResponse.json(datesWithRemaining);
  } catch (error) {
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
