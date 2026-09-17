import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';

/** Audit timeline of one queue, oldest first. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['admin', 'staff'] });
    const { id } = await ctx.params;
    const { data, error } = await supabase
      .from('booking_logs')
      .select('id,action,description,from_value,to_value,actor_kind,created_by,created_at')
      .eq('shop_id', profile.shop_id)
      .eq('booking_id', id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) throw error;

    const actorIds = Array.from(new Set((data ?? []).map((r) => r.created_by).filter(Boolean))) as string[];
    const names = new Map<string, string>();
    if (actorIds.length > 0) {
      const { data: users } = await supabase.from('users_profile').select('id,full_name,email').in('id', actorIds);
      (users ?? []).forEach((u) => names.set(u.id as string, (u.full_name as string | null) || (u.email as string | null) || ''));
    }
    return NextResponse.json({ data: (data ?? []).map((r) => ({ ...r, actor_name: r.created_by ? names.get(r.created_by as string) ?? null : null })) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
