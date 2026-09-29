import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { actionsOfOp, knownActions, parseActivityFilters } from '@/lib/audit/activity-view';

const LOG_SELECT = 'id,user_id,action,target_table,target_id,payload,created_at';

type UserRow = { id: string; full_name: string | null; email: string | null };

/**
 * Audit trail of portal create / update / delete, newest first. Admin only, read-only:
 * rows are written by `logCrud` and there is no route that edits or removes them.
 */
export async function GET(req: Request) {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['admin'] });
    const filters = parseActivityFilters(new URL(req.url).searchParams);

    let query = supabase
      .from('activity_logs')
      .select(LOG_SELECT, { count: 'exact' })
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (filters.op === 'other') query = query.not('action', 'in', `(${knownActions().join(',')})`);
    else if (filters.op) query = query.in('action', actionsOfOp(filters.op));
    if (filters.table) query = query.eq('target_table', filters.table);
    if (filters.userId) query = query.eq('user_id', filters.userId);
    if (filters.from) query = query.gte('created_at', filters.from);
    if (filters.to) query = query.lte('created_at', filters.to);

    const offset = (filters.page - 1) * filters.pageSize;
    const { data, error, count } = await query.range(offset, offset + filters.pageSize - 1);
    if (error) throw error;

    // `activity_logs.user_id` points at auth.users, so names come from a second, shop-scoped read.
    const { data: people, error: peopleError } = await supabase
      .from('users_profile')
      .select('id,full_name,email')
      .eq('shop_id', profile.shop_id)
      .order('full_name', { ascending: true });
    if (peopleError) throw peopleError;

    const users = ((people ?? []) as UserRow[]).map((u) => ({ id: u.id, name: u.full_name?.trim() || u.email || u.id.slice(0, 8) }));
    const nameOf = new Map(users.map((u) => [u.id, u.name]));

    return NextResponse.json({
      data: (data ?? []).map((row) => ({
        ...row,
        user_name: row.user_id ? nameOf.get(row.user_id as string) ?? null : null,
      })),
      users,
      pagination: { page: filters.page, page_size: filters.pageSize, total: count ?? 0 },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
