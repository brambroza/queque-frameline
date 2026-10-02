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
  /** Branches members may see; null = every branch. */
  branch_ids: string[] | null;
  can_export: boolean;
  multi_branch: boolean;
  is_system: boolean;
  sort_order: number;
};

export const ROLE_SELECT = 'id,code,name,description,access_level,menu_keys,branch_ids,can_export,multi_branch,is_system,sort_order';

/** Role row by code, or null. */
export async function findRoleByCode(client: SupabaseClient, code: string): Promise<RoleDef | null> {
  const { data } = await client.from('roles').select(ROLE_SELECT).eq('code', code).eq('is_deleted', false).maybeSingle();
  return (data as RoleDef | null) ?? null;
}

export type GrantRow = { id: string; role_id: string; is_deleted: boolean };

export type GrantPlan = {
  /** Active grants of other roles to soft-delete. */
  staleIds: string[];
  /** Soft-deleted grant of the wanted role to bring back. */
  reviveId: string | null;
  /** No row for the wanted role at all: insert one. */
  insert: boolean;
};

/**
 * Decide how to make `roleId` the only active grant, given every grant row of the
 * user in the shop (deleted ones included). `idx_user_roles_unique` covers
 * (user_id, role_id, shop_id) regardless of `is_deleted`, so a role the user held
 * before — e.g. a staff member removed and added back — must be revived, not inserted.
 */
export function planRoleGrant(rows: GrantRow[], roleId: string): GrantPlan {
  const staleIds = rows.filter((r) => !r.is_deleted && r.role_id !== roleId).map((r) => r.id);
  const sameRole = rows.filter((r) => r.role_id === roleId);
  if (sameRole.some((r) => !r.is_deleted)) return { staleIds, reviveId: null, insert: false };
  return { staleIds, reviveId: sameRole[0]?.id ?? null, insert: sameRole.length === 0 };
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
    .select('id,role_id,is_deleted')
    .eq('user_id', input.userId)
    .eq('shop_id', input.shopId);
  if (readError) throw readError;

  const plan = planRoleGrant((current ?? []) as GrantRow[], input.roleId);
  if (plan.staleIds.length) {
    const { error } = await admin.from('user_roles').update({ is_deleted: true, updated_by: input.actorId }).in('id', plan.staleIds);
    if (error) throw error;
  }
  if (plan.reviveId) {
    const { error } = await admin.from('user_roles').update({ is_deleted: false, updated_by: input.actorId }).eq('id', plan.reviveId);
    if (error) throw error;
  }
  if (plan.insert) {
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
