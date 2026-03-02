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

    const { data: events, error } = await supabaseAdmin
      .from('open_campus_events')
      .select(`
        id, name, description, overview, display_end_date, is_active,
        allow_multiple_dates, max_date_selections, created_at
      `)
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('イベント取得エラー:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const activeEvents = (events || []).filter(event => {
      if (!event.display_end_date) return true;
      return event.display_end_date >= today;
    });

    const eventsWithDates = await Promise.all(
      activeEvents.map(async (event) => {
        const { data: dates } = await supabaseAdmin
          .from('open_campus_dates')
          .select('id, date')
          .eq('event_id', event.id)
          .eq('tenant_id', tenant.id)
          .eq('is_active', true)
          .order('date', { ascending: true });
        return { ...event, dates: dates || [] };
      })
    );

    return NextResponse.json(eventsWithDates);
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
