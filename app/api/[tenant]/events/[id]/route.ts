import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getTenantBySlug } from '@/lib/tenant';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> }
) {
  try {
    const { tenant: slug, id: eventId } = await params;
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const { data: event, error: eventError } = await supabaseAdmin
      .from('open_campus_events')
      .select('*')
      .eq('id', eventId)
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'イベントが見つかりません' }, { status: 404 });
    }

    const { data: dates, error: datesError } = await supabaseAdmin
      .from('open_campus_dates')
      .select('*')
      .eq('event_id', eventId)
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('date', { ascending: true });

    if (datesError) {
      return NextResponse.json({ error: '日程の取得に失敗しました' }, { status: 500 });
    }

    const { data: courses, error: coursesError } = await supabaseAdmin
      .from('event_courses')
      .select('*')
      .eq('event_id', eventId)
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (coursesError) {
      return NextResponse.json({ error: 'コースの取得に失敗しました' }, { status: 500 });
    }

    const coursesWithDates = await Promise.all(
      (courses || []).map(async (course) => {
        const { data: associations } = await supabaseAdmin
          .from('course_date_associations')
          .select('date_id')
          .eq('course_id', course.id);
        return { ...course, applicable_date_ids: (associations || []).map(a => a.date_id) };
      })
    );

    const datesWithRemaining = (dates || []).map(date => ({
      ...date,
      remaining: Math.max(0, date.capacity - date.current_count),
    }));

    return NextResponse.json({ event, dates: datesWithRemaining, courses: coursesWithDates });
  } catch (error) {
    console.error('サーバーエラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
