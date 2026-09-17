import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/lib/audit/activity-log';

const updateSchema = z.object({
  shop_id: z.string().uuid(),
  plan_id: z.string().uuid().nullable().optional(),
  plan_code: z.string().trim().min(1).max(40).optional().nullable(),
  max_branches_override: z.coerce.number().int().min(1).optional().nullable(),
  max_services_override: z.coerce.number().int().min(1).optional().nullable(),
  max_staff_override: z.coerce.number().int().min(1).optional().nullable(),
  max_resources_override: z.coerce.number().int().min(1).optional().nullable(),
  max_monthly_bookings_override: z.coerce.number().int().min(1).optional().nullable(),
  expires_at: z.string().optional().nullable(),
  is_active: z.coerce.boolean().default(true),
  note: z.string().trim().max(500).optional().nullable(),
});

/** Owner contact per shop, for the renewal call the package editor exists to support. */
type ShopOwnerContact = {
  shop_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  /** false when the auth listing could not be read — null dates then mean "unknown", not "never". */
  auth_known: boolean;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  account_created_at: string | null;
};

/** Auth fields the admin list needs. auth.users is not reachable through PostgREST. */
type AuthAccount = { last_sign_in_at: string | null; email_confirmed_at: string | null; created_at: string | null };

/** listUsers is paginated; a super_admin list must not silently stop at page 1. */
const AUTH_PAGE_SIZE = 1000;
const AUTH_MAX_PAGES = 20;

/**
 * Auth-side state (last login, email verification) for every account, keyed by
 * user id. Read through the auth admin API because auth.users is not exposed to
 * PostgREST. Failure degrades to an empty map: knowing the plan matters more
 * than knowing the login date.
 */
async function fetchAuthAccounts(admin: ReturnType<typeof createAdminClient>): Promise<Map<string, AuthAccount>> {
  const map = new Map<string, AuthAccount>();
  try {
    for (let page = 1; page <= AUTH_MAX_PAGES; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: AUTH_PAGE_SIZE });
      if (error || !data?.users?.length) break;
      data.users.forEach((u) => {
        map.set(u.id, {
          last_sign_in_at: u.last_sign_in_at ?? null,
          email_confirmed_at: u.email_confirmed_at ?? null,
          created_at: u.created_at ?? null,
        });
      });
      if (data.users.length < AUTH_PAGE_SIZE) break;
    }
  } catch {
    return map;
  }
  return map;
}

/**
 * Contact details and account state of each shop's owner. Contact is used as the
 * last fallback when neither the shop nor its company carries a phone or email —
 * a brand new shop has an owner login before it has a filled-in profile. Last
 * sign-in and email verification come from the auth account itself.
 *
 * A fixed number of queries regardless of shop count. Failures degrade to an
 * empty list rather than breaking the package list.
 */
async function fetchOwnerContacts(admin: ReturnType<typeof createAdminClient>): Promise<ShopOwnerContact[]> {
  try {
    const { data: ownerRoles, error: rolesError } = await admin
      .from('user_roles')
      .select('shop_id,user_id,roles!inner(code)')
      .eq('roles.code', 'shop_owner')
      .eq('is_deleted', false);

    if (rolesError || !ownerRoles?.length) return [];

    const byUser = new Map<string, string>();
    ownerRoles.forEach((row) => {
      const userId = row.user_id as string | null;
      const shopId = row.shop_id as string | null;
      if (userId && shopId && !byUser.has(userId)) byUser.set(userId, shopId);
    });

    const [{ data: profiles, error: profilesError }, authAccounts] = await Promise.all([
      admin.from('users_profile').select('id,full_name,email,phone').in('id', [...byUser.keys()]).eq('is_deleted', false),
      fetchAuthAccounts(admin),
    ]);

    if (profilesError || !profiles) return [];

    return profiles.flatMap((p) => {
      const userId = String(p.id);
      const shopId = byUser.get(userId);
      if (!shopId) return [];
      const auth = authAccounts.get(userId);
      return [
        {
          shop_id: shopId,
          full_name: (p.full_name as string | null) ?? null,
          email: (p.email as string | null) ?? null,
          phone: (p.phone as string | null) ?? null,
          auth_known: Boolean(auth),
          last_sign_in_at: auth?.last_sign_in_at ?? null,
          email_confirmed_at: auth?.email_confirmed_at ?? null,
          account_created_at: auth?.created_at ?? null,
        },
      ];
    });
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    await requireAuthContext({ roles: ['super_admin'] });
    const admin = createAdminClient();

    const [{ data: plans, error: plansError }, { data: shops, error: shopsError }, { data: subs, error: subsError }, owners] = await Promise.all([
      admin.from('subscription_plans').select('*').eq('active', true).order('name'),
      admin
        .from('shops')
        .select('id,name,shop_key,phone,email,company_id,companies(name,owner_name,phone,email)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: true }),
      admin
        .from('shop_subscriptions')
        .select('*, subscription_plans(name,code,max_branches,max_services,max_staff,max_resources,max_monthly_bookings)')
        .eq('is_deleted', false),
      fetchOwnerContacts(admin),
    ]);

    if (plansError) throw plansError;
    if (shopsError) throw shopsError;
    if (subsError) throw subsError;

    return NextResponse.json({ data: { plans: plans ?? [], shops: shops ?? [], subscriptions: subs ?? [], owners } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { user } = await requireAuthContext({ roles: ['super_admin'] });
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const admin = createAdminClient();
    const payload = parsed.data;

    const { data: shop, error: shopError } = await admin.from('shops').select('id,company_id').eq('id', payload.shop_id).eq('is_deleted', false).single();
    if (shopError || !shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

    const { data: beforeSub } = await admin
      .from('shop_subscriptions')
      .select('id,plan_id,plan_code,expires_at,is_active,max_branches_override,max_services_override,max_staff_override,max_resources_override,max_monthly_bookings_override')
      .eq('shop_id', payload.shop_id)
      .eq('is_deleted', false)
      .maybeSingle();

    const { error } = await admin.from('shop_subscriptions').upsert(
      {
        shop_id: payload.shop_id,
        company_id: shop.company_id,
        plan_id: payload.plan_id ?? null,
        plan_code: payload.plan_code ?? null,
        max_branches_override: payload.max_branches_override ?? null,
        max_services_override: payload.max_services_override ?? null,
        max_staff_override: payload.max_staff_override ?? null,
        max_resources_override: payload.max_resources_override ?? null,
        max_monthly_bookings_override: payload.max_monthly_bookings_override ?? null,
        expires_at: payload.expires_at ?? null,
        is_active: payload.is_active,
        note: payload.note ?? null,
        updated_by: user.id,
        created_by: user.id,
      },
      { onConflict: 'shop_id' },
    );

    if (error) throw error;

    await writeAuditLog({
      companyId: shop.company_id,
      shopId: payload.shop_id,
      userId: user.id,
      action: 'subscription_plan_changed',
      targetTable: 'shop_subscriptions',
      targetId: String(beforeSub?.id ?? payload.shop_id),
      payload: {
        before: beforeSub ?? null,
        after: {
          plan_id: payload.plan_id ?? null,
          plan_code: payload.plan_code ?? null,
          expires_at: payload.expires_at ?? null,
          is_active: payload.is_active,
          max_branches_override: payload.max_branches_override ?? null,
          max_services_override: payload.max_services_override ?? null,
          max_staff_override: payload.max_staff_override ?? null,
          max_resources_override: payload.max_resources_override ?? null,
          max_monthly_bookings_override: payload.max_monthly_bookings_override ?? null,
          note: payload.note ?? null,
        },
      },
    });

    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
