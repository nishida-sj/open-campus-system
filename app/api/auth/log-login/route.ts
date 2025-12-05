/**
 * í°¤óet2API
 * POST /api/auth/log-login
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, success, failure_reason, session_id } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // IP¢Éì¹hUser-Agent’Ö—
    const headersList = headers();
    const ipAddress = headersList.get('x-forwarded-for') ||
                     headersList.get('x-real-ip') ||
                     'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';

    // æü¶üID’Ö—ŸBn	
    let userId: string | null = null;
    if (success) {
      const { data } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      userId = data?.id || null;

      // í°¤óŸBolast_login_at’ô°
      if (userId) {
        await supabaseAdmin
          .from('users')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', userId);
      }
    }

    // í°¤óet’2
    const { error } = await supabaseAdmin
      .from('login_logs')
      .insert({
        user_id: userId,
        email,
        success,
        ip_address: ipAddress,
        user_agent: userAgent,
        failure_reason: failure_reason || null,
        session_id: session_id || null,
      });

    if (error) {
      console.error('Failed to log login:', error);
      return NextResponse.json(
        { error: 'Failed to log login' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Log login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
