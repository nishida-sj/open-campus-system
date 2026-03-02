import { NextResponse } from 'next/server';
import { logLogin } from '@/lib/auth';
import { getTenantBySlug } from '@/lib/tenant';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: slug } = await params;
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const body = await request.json();
    const { email, success, failure_reason, session_id } = body;

    if (!email || success === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await logLogin(email, success, tenant.id, ip, userAgent, failure_reason, session_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/[tenant]/auth/log-login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
