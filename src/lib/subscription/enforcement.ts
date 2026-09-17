import { createAdminClient } from '@/lib/supabase/admin';

export type FeatureKey = 'branches' | 'services' | 'staff' | 'resources' | 'bookings';

/** Plan code that every shop falls back to. Free forever, quota-limited. */
export const FREE_PLAN_CODE = 'starter';

type Limits = {
  max_branches: number | null;
  max_services: number | null;
  max_staff: number | null;
  max_resources: number | null;
  max_monthly_bookings: number | null;
};

export type SubscriptionState = {
  active: boolean;
  /** True when a paid plan has lapsed and the shop is running on free-tier limits. */
  downgraded: boolean;
  planCode: string | null;
  limits: Limits;
};

const FEATURE_LABEL_TH: Record<FeatureKey, string> = {
  branches: 'สาขา',
  services: 'บริการ',
  staff: 'พนักงาน',
  resources: 'ทรัพยากร',
  bookings: 'การจองต่อเดือน',
};

/**
 * Raised when a shop is suspended by an administrator. Distinct from a quota
 * wall: there is no self-serve action that clears it.
 */
export class SubscriptionInactiveError extends Error {
  readonly kind = 'subscription_inactive';
  readonly status = 403;

  constructor(message = 'แพ็กเกจร้านถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ') {
    super(message);
    this.name = 'SubscriptionInactiveError';
  }
}

/**
 * Raised when a shop hits a plan quota. Carries the structured detail the
 * client needs to render an upgrade prompt instead of a bare error toast.
 */
export class SubscriptionQuotaError extends Error {
  readonly kind = 'quota_exceeded';
  readonly status = 402;
  readonly feature: FeatureKey;
  readonly featureLabel: string;
  readonly limit: number;
  readonly planCode: string | null;

  constructor(feature: FeatureKey, limit: number, planCode: string | null) {
    const label = FEATURE_LABEL_TH[feature];
    super(`แพ็กเกจปัจจุบันใช้${label}ได้สูงสุด ${limit} รายการ อัปเกรดแพ็กเกจเพื่อเพิ่มสิทธิ์`);
    this.name = 'SubscriptionQuotaError';
    this.feature = feature;
    this.featureLabel = label;
    this.limit = limit;
    this.planCode = planCode;
  }

  /** Serializable payload for the paywall modal. */
  toJSON() {
    return {
      kind: this.kind,
      feature: this.feature,
      feature_label: this.featureLabel,
      limit: this.limit,
      plan_code: this.planCode,
      message: this.message,
    };
  }
}

function toNullableInt(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type PlanLimitRow = {
  code?: string | null;
  max_branches?: number | null;
  max_services?: number | null;
  max_staff?: number | null;
  max_resources?: number | null;
  max_monthly_bookings?: number | null;
};

function planToLimits(plan: PlanLimitRow | null): Limits {
  return {
    max_branches: toNullableInt(plan?.max_branches),
    max_services: toNullableInt(plan?.max_services),
    max_staff: toNullableInt(plan?.max_staff),
    max_resources: toNullableInt(plan?.max_resources),
    max_monthly_bookings: toNullableInt(plan?.max_monthly_bookings),
  };
}

/**
 * Free-tier limits, read from the database so the plan table stays the single
 * source of truth. Falls back to conservative hardcoded values only when the
 * starter plan row is missing, because returning unlimited here would hand
 * every unconfigured shop an unlimited plan.
 */
async function getFreePlanLimits(): Promise<Limits> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('subscription_plans')
    .select('code,max_branches,max_services,max_staff,max_resources,max_monthly_bookings')
    .eq('code', FREE_PLAN_CODE)
    .maybeSingle();

  if (!data) {
    return { max_branches: 1, max_services: 3, max_staff: 3, max_resources: 10, max_monthly_bookings: 50 };
  }
  return planToLimits(data as PlanLimitRow);
}

async function getShopSubscriptionState(shopId: string): Promise<SubscriptionState> {
  const admin = createAdminClient();

  const { data: sub } = await admin
    .from('shop_subscriptions')
    .select('*, subscription_plans(max_branches,max_services,max_staff,max_resources,max_monthly_bookings,code)')
    .eq('shop_id', shopId)
    .eq('is_deleted', false)
    .maybeSingle();

  // No subscription row means free tier, never unlimited.
  if (!sub) {
    return {
      active: true,
      downgraded: false,
      planCode: FREE_PLAN_CODE,
      limits: await getFreePlanLimits(),
    };
  }

  const plan = (sub.subscription_plans as PlanLimitRow | null) ?? null;
  const planLimits = planToLimits(plan);
  const planCode = (sub.plan_code as string | null) ?? plan?.code ?? FREE_PLAN_CODE;

  const expiresAt = sub.expires_at ? new Date(String(sub.expires_at)) : null;
  const expired = Boolean(expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now());

  // A lapsed paid plan drops to free-tier limits rather than blocking the shop.
  // Hard-blocking an expired shop also blocks its customers from booking, which
  // costs the shop money and churns the account before sales can follow up.
  if (expired && planCode !== FREE_PLAN_CODE) {
    return {
      active: Boolean(sub.is_active),
      downgraded: true,
      planCode: FREE_PLAN_CODE,
      limits: await getFreePlanLimits(),
    };
  }

  return {
    active: Boolean(sub.is_active),
    downgraded: false,
    planCode,
    limits: {
      max_branches: toNullableInt(sub.max_branches_override) ?? planLimits.max_branches,
      max_services: toNullableInt(sub.max_services_override) ?? planLimits.max_services,
      max_staff: toNullableInt(sub.max_staff_override) ?? planLimits.max_staff,
      max_resources: toNullableInt(sub.max_resources_override) ?? planLimits.max_resources,
      max_monthly_bookings: toNullableInt(sub.max_monthly_bookings_override) ?? planLimits.max_monthly_bookings,
    },
  };
}

function getLimitForFeature(limits: Limits, feature: FeatureKey): number | null {
  if (feature === 'branches') return limits.max_branches;
  if (feature === 'services') return limits.max_services;
  if (feature === 'staff') return limits.max_staff;
  if (feature === 'resources') return limits.max_resources;
  return limits.max_monthly_bookings;
}

/** Read-only view of a shop's effective plan, for UI that renders usage vs limit. */
export async function getSubscriptionState(shopId: string): Promise<SubscriptionState> {
  return getShopSubscriptionState(shopId);
}

export async function assertShopSubscriptionActive(shopId: string): Promise<SubscriptionState> {
  const sub = await getShopSubscriptionState(shopId);
  if (!sub.active) {
    throw new SubscriptionInactiveError();
  }
  return sub;
}

export async function assertFeatureQuota(
  shopId: string,
  feature: FeatureKey,
  currentCount: number
): Promise<SubscriptionState> {
  const sub = await assertShopSubscriptionActive(shopId);
  const limit = getLimitForFeature(sub.limits, feature);
  if (limit === null) return sub;
  if (currentCount >= limit) {
    throw new SubscriptionQuotaError(feature, limit, sub.planCode);
  }
  return sub;
}
