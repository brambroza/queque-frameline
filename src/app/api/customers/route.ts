import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { applyBranchScope, type BranchScope } from '@/lib/auth/branch-scope';
import { writeAuditLog } from '@/lib/audit/activity-log';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NICKNAME_MAX, nicknamePatch, normalizeNicknameInput } from '@/lib/booking/customer-label';

const customerSchema = z.object({
  // A LINE display name can legitimately be a single character, so length is
  // only there to reject blank names.
  full_name: z.string().trim().min(1),
  /** ชื่อเล่น used to call the queue; blank clears it. */
  nickname: z.string().max(NICKNAME_MAX).optional().nullable(),
  phone: z.string().min(8),
  note: z.string().optional().nullable(),
  line_user_id: z.string().uuid().optional().nullable(),
});

const CUSTOMER_SELECT = 'id,full_name,nickname,phone,note,line_user_id,created_at';

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * `customers` has no branch column, so a branch-bound user's visible customers are
 * derived from the bookings they may see.
 *
 * @returns Customer ids reachable from the caller's branches, or `null` when the
 *   caller sees the whole shop and no id filter is needed.
 */
async function customerIdsInBranchScope(
  supabase: SupabaseClient,
  shopId: string | null,
  scope: BranchScope
): Promise<string[] | null> {
  if (scope === null) return null;
  const { data, error } = await applyBranchScope(
    supabase.from('bookings').select('customer_id').eq('shop_id', shopId).eq('is_deleted', false),
    scope
  );
  if (error) throw error;
  const ids = (data ?? [])
    .map((row) => row.customer_id as string | null)
    .filter((id): id is string => Boolean(id));
  return Array.from(new Set(ids));
}

export async function GET(req: Request) {
  try {
    const { supabase, profile, branchScope } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    const page = toInt(searchParams.get('page'), 1);
    const pageSize = Math.min(toInt(searchParams.get('page_size'), 20), 100);

    const allowedCustomerIds = await customerIdsInBranchScope(supabase, profile.shop_id, branchScope);

    let query = supabase
      .from('customers')
      .select(CUSTOMER_SELECT, { count: 'exact' })
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (allowedCustomerIds) query = query.in('id', allowedCustomerIds);

    if (q) {
      query = query.or(`full_name.ilike.%${q}%,nickname.ilike.%${q}%,phone.ilike.%${q}%,note.ilike.%${q}%`);
    }

    const from = (page - 1) * pageSize;
    const { data, error, count } = await query.range(from, from + pageSize - 1);
    if (error) throw error;

    const lineUserIds = (data ?? []).map((r) => r.line_user_id).filter(Boolean) as string[];
    const { data: lineUsers } = lineUserIds.length
      ? await supabase.from('line_users').select('id,line_user_id,display_name').in('id', lineUserIds)
      : { data: [] as Array<{ id: string; line_user_id: string; display_name: string | null }> };

    const lineMap = new Map((lineUsers ?? []).map((x) => [x.id, x]));

    const rows = (data ?? []).map((r) => ({
      ...r,
      line_user: r.line_user_id ? lineMap.get(r.line_user_id) ?? null : null,
    }));

    return NextResponse.json({ data: rows, pagination: { page, page_size: pageSize, total: count ?? 0 } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const parsed = customerSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });

    const payload = parsed.data;
    const { error } = await supabase.from('customers').insert({
      company_id: profile.company_id,
      shop_id: profile.shop_id,
      line_user_id: payload.line_user_id ?? null,
      full_name: payload.full_name,
      nickname: normalizeNicknameInput(payload.nickname) ?? null,
      phone: payload.phone,
      note: payload.note ?? null,
      created_by: user.id,
      updated_by: user.id,
    });
    if (error) throw error;

    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile, branchScope } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const body = await req.json();
    const id = body.id as string;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const parsed = customerSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });

    const allowedCustomerIds = await customerIdsInBranchScope(supabase, profile.shop_id, branchScope);
    if (allowedCustomerIds && !allowedCustomerIds.includes(id)) {
      return NextResponse.json({ error: 'Forbidden (customer out of branch scope)' }, { status: 403 });
    }

    const payload = parsed.data;
    // Omitted nickname keeps the stored one (same semantics as the booking and
    // LIFF routes); an explicit '' or null clears it.
    const nickname = nicknamePatch(payload.nickname);
    const { error } = await supabase
      .from('customers')
      .update({
        line_user_id: payload.line_user_id ?? null,
        full_name: payload.full_name,
        ...nickname,
        phone: payload.phone,
        note: payload.note ?? null,
        updated_by: user.id,
      })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);

    if (error) throw error;
    await writeAuditLog({
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      action: 'data_updated',
      targetTable: 'customers',
      targetId: id,
      payload: { full_name: payload.full_name, ...nickname },
    });
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function DELETE(req: Request) {
  try {
    const { supabase, user, profile, branchScope } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const allowedCustomerIds = await customerIdsInBranchScope(supabase, profile.shop_id, branchScope);
    if (allowedCustomerIds && !allowedCustomerIds.includes(id)) {
      return NextResponse.json({ error: 'Forbidden (customer out of branch scope)' }, { status: 403 });
    }

    const { error } = await supabase
      .from('customers')
      .update({ is_deleted: true, updated_by: user.id })
      .eq('id', id)
      .eq('shop_id', profile.shop_id);

    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
