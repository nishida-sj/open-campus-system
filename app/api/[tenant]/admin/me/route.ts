import { NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/auth';
import { getTenantBySlug } from '@/lib/tenant';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: slug } = await params;
    const tenant = await getTenantBySlug(slug);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const currentUser = await getCurrentUserFromRequest(tenant.id);

    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    return NextResponse.json({ user: currentUser });
  } catch (error) {
    console.error('GET /api/[tenant]/admin/me error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
