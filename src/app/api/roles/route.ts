import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/lib/audit/activity-log';
import { ROLE_SELECT, type RoleDef } from '@/lib/auth/role-grants';
import { validateRoleMenuKeys } from '@/lib/auth/menu-registry';

const codeSchema = z.string().trim().regex(/^[a-z][a-z0-9_]{1,31}$/, 'รหัสใช้ a-z 0-9 _ ขึ้นต้นด้วยตัวอักษร ยาว 2–32');

const createSchema = z.object({
  code: codeSchema,
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(200).optional().nullable(),
  access_level: z.enum(['admin', 'staff']),
  /** null = every menu the level allows */
  menu_keys: z.array(z.string()).nullable(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(60).optional(),
  description: z.string().trim().max(200).optional().nullable(),
  access_level: z.enum(['admin', 'staff']).optional(),
  menu_keys: z.array(z.string()).nullable().optional(),
});

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Menu list check shared by create and update. Returns the cleaned list or a 400. */
function checkMenus(level: 'admin' | 'staff', keys: string[] | null | undefined): { keys: string[] | null; error?: undefined } | { error: string; keys?: undefined } {
  if (keys == null) return { keys: null };
  const v = validateRoleMenuKeys(level, keys);
  return v.ok ? { keys: v.keys as string[] } : { error: v.error };
}

/** Roles with how many active members hold each. Staff may read (pickers); admin manages. */
export async function GET() {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['admin', 'staff'] });
    const [rolesRes, grantsRes] = await Promise.all([
      supabase.from('roles').select(ROLE_SELECT).eq('is_deleted', false).order('sort_order').order('created_at'),
      supabase.from('user_roles').select('role_id,user_id').eq('shop_id', profile.shop_id).eq('is_deleted', false),
    ]);
    if (rolesRes.error) throw rolesRes.error;
    if (grantsRes.error) throw grantsRes.error;
    const counts = new Map<string, Set<string>>();
    (grantsRes.data ?? []).forEach((g) => {
      const set = counts.get(g.role_id) ?? new Set<string>();
      set.add(g.user_id);
      counts.set(g.role_id, set);
    });
    const data = ((rolesRes.data ?? []) as RoleDef[]).map((r) => ({ ...r, user_count: counts.get(r.id)?.size ?? 0 }));
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAuthContext({ roles: ['admin'] });
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง');
    const body = parsed.data;
    const menus = checkMenus(body.access_level, body.menu_keys);
    if (menus.error !== undefined) return fail(menus.error);

    const admin = createAdminClient();
    const { data: existing } = await admin.from('roles').select('id,is_deleted').eq('code', body.code).maybeSingle();
    if (existing && !existing.is_deleted) return fail('มีรหัสสิทธิ์นี้อยู่แล้ว', 409);

    const { count } = await admin.from('roles').select('id', { count: 'exact', head: true }).eq('is_deleted', false);
    const row = {
      code: body.code,
      name: body.name,
      description: body.description ?? null,
      access_level: body.access_level,
      menu_keys: menus.keys,
      is_system: false,
      sort_order: (count ?? 0) + 1,
      is_deleted: false,
      updated_by: user.id,
    };
    // A soft-deleted code is revived instead of violating the unique index.
    const write = existing
      ? admin.from('roles').update(row).eq('id', existing.id).select(ROLE_SELECT).single()
      : admin.from('roles').insert({ ...row, created_by: user.id }).select(ROLE_SELECT).single();
    const { data, error } = await write;
    if (error) throw error;

    await writeAuditLog({ companyId: profile.company_id, shopId: profile.shop_id, userId: user.id, action: 'role_created', targetTable: 'roles', targetId: data.id, payload: row });
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, profile } = await requireAuthContext({ roles: ['admin'] });
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง');
    const body = parsed.data;

    const admin = createAdminClient();
    const { data: current } = await admin.from('roles').select(ROLE_SELECT).eq('id', body.id).eq('is_deleted', false).maybeSingle();
    const role = current as RoleDef | null;
    if (!role) return fail('ไม่พบสิทธิ์นี้', 404);
    if (role.is_system && body.access_level && body.access_level !== role.access_level) return fail('เปลี่ยนระดับของสิทธิ์พื้นฐานไม่ได้');

    const level = body.access_level ?? role.access_level;
    const menus = checkMenus(level, body.menu_keys === undefined ? role.menu_keys : body.menu_keys);
    if (menus.error !== undefined) return fail(menus.error);

    const patch = {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      access_level: level,
      menu_keys: menus.keys,
      updated_by: user.id,
    };
    const { data, error } = await admin.from('roles').update(patch).eq('id', role.id).select(ROLE_SELECT).single();
    if (error) throw error;

    await writeAuditLog({ companyId: profile.company_id, shopId: profile.shop_id, userId: user.id, action: 'role_updated', targetTable: 'roles', targetId: role.id, payload: patch });
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function DELETE(req: Request) {
  try {
    const { user, profile } = await requireAuthContext({ roles: ['admin'] });
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return fail('Missing id');

    const admin = createAdminClient();
    const { data: current } = await admin.from('roles').select(ROLE_SELECT).eq('id', id).eq('is_deleted', false).maybeSingle();
    const role = current as RoleDef | null;
    if (!role) return fail('ไม่พบสิทธิ์นี้', 404);
    if (role.is_system) return fail('ลบสิทธิ์พื้นฐานไม่ได้');

    const { count } = await admin.from('user_roles').select('id', { count: 'exact', head: true }).eq('role_id', id).eq('is_deleted', false);
    if ((count ?? 0) > 0) return fail(`ยังมีพนักงาน ${count} คนใช้สิทธิ์นี้ — เปลี่ยนสิทธิ์ของพวกเขาก่อน`, 409);

    const { error } = await admin.from('roles').update({ is_deleted: true, updated_by: user.id }).eq('id', id);
    if (error) throw error;

    await writeAuditLog({ companyId: profile.company_id, shopId: profile.shop_id, userId: user.id, action: 'role_deleted', targetTable: 'roles', targetId: id, payload: { code: role.code } });
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
