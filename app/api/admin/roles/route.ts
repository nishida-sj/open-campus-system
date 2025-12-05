/**
 * νόλ΅API
 * GET /api/admin/roles - hνόλΦ—
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * hνόλΦ—
 */
export async function GET() {
  try {
    const { data: roles, error } = await supabaseAdmin
      .from('roles')
      .select('*')
      .order('level', { ascending: false });

    if (error) {
      console.error('Roles fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch roles' },
        { status: 500 }
      );
    }

    return NextResponse.json({ roles });
  } catch (error) {
    console.error('GET /api/admin/roles error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
