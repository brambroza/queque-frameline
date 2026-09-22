/**
 * Server-side helpers for role definitions and grants. Writes go through the
 * service-role client: `roles` is select-only under RLS, and callers have
 * already passed an admin-level `requireAuthContext`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppRole } from '@/types/db';

export type RoleDef = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  access_level: AppRole;
  menu_keys: string[] | null;
  is_system: boolean;
  sort_order: number;
};

export const ROLE_SELECT = 'id,code,name,description,access_level,menu_keys,is_system,sort_order';

/** Role row by code, or null. */
export async function findRoleByCode(client: SupabaseClient, code: string): Promise<RoleDef | null> {
  const { data } = await client.from('roles').select(ROLE_SELECT).eq('code', code).eq('is_deleted', false).maybeSingle();
  return (data as RoleDef | null) ?? null;
}

/**
 * Make `roleId` the user's only active grant in the shop. Other grants are
 * soft-deleted so a member holds exactly one role at a time.
 */
export async function setUserRole(
  admin: SupabaseClient,
  input: { userId: string; roleId: string; shopId: string; companyId: string; actorId: string }
): Promise<void> {
  const { data: current, error: readError } = await admin
    .from('user_roles')
    .select('id,role_id')
    .eq('user_id', input.userId)
    .eq('shop_id', input.shopId)
    .eq('is_deleted', false);
  if (readError) throw readError;

  const rows = (current ?? []) as Array<{ id: string; role_id: string }>;
  const stale = rows.filter((r) => r.role_id !== input.roleId).map((r) => r.id);
  if (stale.length) {
    const { error } = await admin.from('user_roles').update({ is_deleted: true, updated_by: input.actorId }).in('id', stale);
    if (error) throw error;
  }
  if (!rows.some((r) => r.role_id === input.roleId)) {
    const { error } = await admin.from('user_roles').insert({
      user_id: input.userId,
      role_id: input.roleId,
      company_id: input.companyId,
      shop_id: input.shopId,
      created_by: input.actorId,
      updated_by: input.actorId,
    });
    if (error) throw error;
  }
}

/** Soft-delete every active grant of the user in the shop. */
export async function revokeUserRoles(admin: SupabaseClient, input: { userId: string; shopId: string; actorId: string }): Promise<void> {
  const { error } = await admin
    .from('user_roles')
    .update({ is_deleted: true, updated_by: input.actorId })
    .eq('user_id', input.userId)
    .eq('shop_id', input.shopId)
    .eq('is_deleted', false);
  if (error) throw error;
}

/** Users (other than `excludeUserId`) holding an admin-level role in the shop. */
export async function countOtherAdmins(admin: SupabaseClient, shopId: string, excludeUserId: string): Promise<number> {
  const { data, error } = await admin
    .from('user_roles')
    .select('user_id, roles!inner(access_level, is_deleted)')
    .eq('shop_id', shopId)
    .eq('is_deleted', false)
    .eq('roles.access_level', 'admin')
    .eq('roles.is_deleted', false)
    .neq('user_id', excludeUserId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => (r as { user_id: string }).user_id)).size;
}

/** Active grants of a user in the shop, with the role rows. */
export async function rolesOfUser(client: SupabaseClient, userId: string, shopId: string): Promise<RoleDef[]> {
  const { data } = await client
    .from('user_roles')
    .select(`role_id, roles!inner(${ROLE_SELECT},is_deleted)`)
    .eq('user_id', userId)
    .eq('shop_id', shopId)
    .eq('is_deleted', false)
    .eq('roles.is_deleted', false);
  return (data ?? []).map((r) => (r as unknown as { roles: RoleDef | null }).roles).filter((r): r is RoleDef => Boolean(r));
}
