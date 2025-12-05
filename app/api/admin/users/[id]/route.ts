/**
 * %æü¶ü¡API
 * PUT /api/admin/users/[id] - æü¶üô°
 * DELETE /api/admin/users/[id] - æü¶üJd
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUser, ROLE_LEVELS } from '@/lib/auth';

/**
 * æü¶üÅ1ô°
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;

    // )PÁ§Ã¯¹üÑü¡n
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.max_role_level < ROLE_LEVELS.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { full_name, is_active, role_ids } = body;

    // ÐêÇü·çó
    if (!full_name) {
      return NextResponse.json(
        { error: 'Full name is required' },
        { status: 400 }
      );
    }

    // 1. æü¶üÅ1’ô°
    const { error: userError } = await supabaseAdmin
      .from('users')
      .update({
        full_name,
        is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (userError) {
      console.error('User update error:', userError);
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      );
    }

    // 2. íüë’ô°šUŒfD‹4	
    if (role_ids && Array.isArray(role_ids)) {
      // âXníüë’YyfJd
      await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // °WDíüë’rŠSf
      if (role_ids.length > 0) {
        const roleAssignments = role_ids.map((roleId: string) => ({
          user_id: userId,
          role_id: roleId,
          assigned_by: currentUser.id,
        }));

        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .insert(roleAssignments);

        if (roleError) {
          console.error('Role assignment error:', roleError);
          return NextResponse.json(
            { error: 'Failed to update roles' },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/admin/users/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * æü¶üJd
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;

    // )PÁ§Ã¯¹üÑü¡n
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.max_role_level < ROLE_LEVELS.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // êê«oJdgMjD
    if (userId === currentUser.id) {
      return NextResponse.json(
        { error: 'Cannot delete yourself' },
        { status: 400 }
      );
    }

    // 1. Supabase AuthK‰æü¶ü’Jd
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('Auth user deletion error:', authError);
      return NextResponse.json(
        { error: 'Failed to delete auth user' },
        { status: 500 }
      );
    }

    // 2. Çü¿Ùü¹K‰æü¶ü’JdCASCADE-šgíüë‚JdUŒ‹	
    const { error: userError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    if (userError) {
      console.error('User deletion error:', userError);
      return NextResponse.json(
        { error: 'Failed to delete user from database' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/admin/users/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
