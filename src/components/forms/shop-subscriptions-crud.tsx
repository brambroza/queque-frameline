'use client';

import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { ActionIconGroup } from '@/components/ui/action-icon-group';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { TablePaginationControls } from '@/components/ui/table-pagination-controls';

/** Plan code every shop falls back to. Mirrors FREE_PLAN_CODE in src/lib/subscription/enforcement.ts */
const FREE_PLAN_CODE = 'starter';

/** Expiry inside this window is worth flagging before it lapses. */
const EXPIRING_SOON_DAYS = 30;

const DAY_MS = 1000 * 60 * 60 * 24;

type LimitKey = 'max_branches' | 'max_services' | 'max_staff' | 'max_resources' | 'max_monthly_bookings';
type OverrideKey =
  | 'max_branches_override'
  | 'max_services_override'
  | 'max_staff_override'
  | 'max_resources_override'
  | 'max_monthly_bookings_override';
type UsageKey = 'branches' | 'services' | 'staff' | 'resources' | 'bookings';

type PlanLimits = Record<LimitKey, number | null>;

type Plan = {
  id: string;
  code: string;
  name: string;
  /** Optional: pricing columns arrive with migration 202608190001_revenue_ops.sql */
  price_monthly?: number | null;
  currency?: string | null;
} & Partial<PlanLimits>;

type Shop = {
  id: string;
  name: string;
  shop_key: string;
  phone?: string | null;
  email?: string | null;
  companies?: { name?: string; owner_name?: string | null; phone?: string | null; email?: string | null } | null;
};

type OwnerContact = {
  shop_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  /** false = auth listing unavailable, so the dates below mean "unknown", not "never". */
  auth_known?: boolean;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
  account_created_at?: string | null;
};

/** A shop with no owner login for this long is a churn signal, not just a quiet week. */
const DORMANT_DAYS = 30;

/** Where a contact detail came from, so a super_admin knows who they are calling. */
type ContactSource = 'shop' | 'company' | 'owner';

const CONTACT_SOURCE_LABEL: Record<ContactSource, string> = {
  shop: '',
  company: 'บริษัท',
  owner: 'เจ้าของบัญชี',
};

type Sub = {
  shop_id: string;
  plan_id?: string | null;
  plan_code?: string | null;
  starts_at?: string | null;
  expires_at?: string | null;
  updated_at?: string | null;
  is_active: boolean;
  max_branches_override?: number | null;
  max_services_override?: number | null;
  max_staff_override?: number | null;
  max_resources_override?: number | null;
  max_monthly_bookings_override?: number | null;
  note?: string | null;
  subscription_plans?: ({ name?: string; code?: string } & Partial<PlanLimits>) | null;
};

type ShopUsage = Record<UsageKey, number>;

type DailyPoint = { date: string; count: number };

/** Per-day booking load, for judging whether a plan's monthly quota matches the real daily peak. */
type DailyUsage = {
  days: number;
  series: DailyPoint[];
  total: number;
  averagePerDay: number;
  averagePerActiveDay: number;
  peak: DailyPoint | null;
  today: number;
  activeDays: number;
};

type UsageResponse = {
  usage: ShopUsage;
  daily?: DailyUsage | null;
  effective: { plan_code: string | null; limits: PlanLimits; active: boolean; downgraded: boolean };
};

const LIMIT_FIELDS: Array<{ limitKey: LimitKey; overrideKey: OverrideKey; usageKey: UsageKey; label: string; shortLabel: string }> = [
  { limitKey: 'max_branches', overrideKey: 'max_branches_override', usageKey: 'branches', label: 'สาขา', shortLabel: 'สาขา' },
  { limitKey: 'max_services', overrideKey: 'max_services_override', usageKey: 'services', label: 'บริการ', shortLabel: 'บริการ' },
  { limitKey: 'max_staff', overrideKey: 'max_staff_override', usageKey: 'staff', label: 'พนักงาน', shortLabel: 'พนักงาน' },
  { limitKey: 'max_resources', overrideKey: 'max_resources_override', usageKey: 'resources', label: 'ทรัพยากร', shortLabel: 'ทรัพยากร' },
  {
    limitKey: 'max_monthly_bookings',
    overrideKey: 'max_monthly_bookings_override',
    usageKey: 'bookings',
    label: 'การจองต่อเดือน',
    shortLabel: 'คิว/เดือน',
  },
];

type StatusTone = 'ok' | 'warn' | 'danger' | 'neutral';

type RowState = {
  hasSub: boolean;
  planCode: string;
  planName: string | null;
  suspended: boolean;
  expired: boolean;
  /** Paid plan lapsed: the shop keeps running on free-tier limits. */
  downgraded: boolean;
  expiringSoon: boolean;
  daysRemaining: number | null;
  limits: PlanLimits;
  overridden: Record<LimitKey, boolean>;
};

function toNullableInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function planToLimits(plan: Partial<PlanLimits> | null | undefined): PlanLimits {
  return {
    max_branches: toNullableInt(plan?.max_branches),
    max_services: toNullableInt(plan?.max_services),
    max_staff: toNullableInt(plan?.max_staff),
    max_resources: toNullableInt(plan?.max_resources),
    max_monthly_bookings: toNullableInt(plan?.max_monthly_bookings),
  };
}

function formatLimit(value: number | null): string {
  return value === null ? '∞' : value.toLocaleString('th-TH');
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('th-TH', { dateStyle: 'medium' });
}

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Whole days between now and a timestamp, or null when the timestamp is missing/invalid. */
function daysSince(value?: string | null): number | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / DAY_MS);
}

function relativeDayLabel(days: number): string {
  if (days <= 0) return 'วันนี้';
  if (days === 1) return 'เมื่อวาน';
  return `${days} วันก่อน`;
}

/** Login + verification state of the owner account, as the list and summary both read it. */
type AccountState = {
  /** Auth listing readable at all — false means every field below is unknown. */
  known: boolean;
  lastSignInAt: string | null;
  daysSinceSignIn: number | null;
  neverSignedIn: boolean;
  dormant: boolean;
  verified: boolean;
};

/**
 * Owner-account signals for one shop.
 *
 * @param owner - Owner contact row for the shop, when one is mapped.
 */
function resolveAccountState(owner: OwnerContact | undefined): AccountState {
  const known = Boolean(owner?.auth_known);
  const lastSignInAt = owner?.last_sign_in_at ?? null;
  const days = daysSince(lastSignInAt);
  return {
    known,
    lastSignInAt,
    daysSinceSignIn: days,
    neverSignedIn: known && !lastSignInAt,
    dormant: days !== null && days >= DORMANT_DAYS,
    verified: Boolean(owner?.email_confirmed_at),
  };
}

type ResolvedContact = {
  phone: string | null;
  phoneSource: ContactSource | null;
  email: string | null;
  emailSource: ContactSource | null;
  contactName: string | null;
};

function firstFilled(candidates: Array<[ContactSource, string | null | undefined]>): [string, ContactSource] | null {
  for (const [source, value] of candidates) {
    const trimmed = value?.trim();
    if (trimmed) return [trimmed, source];
  }
  return null;
}

/**
 * Phone and email for a shop, falling back shop → company → owner account.
 * A shop that registered yesterday often has contact details only on its owner
 * login, and an empty cell here means nobody to call about renewal.
 *
 * @param shop - Shop row with its company join.
 * @param owner - Owner account contact for that shop, when one is mapped.
 */
function resolveContact(shop: Shop, owner: OwnerContact | undefined): ResolvedContact {
  const phone = firstFilled([
    ['shop', shop.phone],
    ['company', shop.companies?.phone],
    ['owner', owner?.phone],
  ]);
  const email = firstFilled([
    ['shop', shop.email],
    ['company', shop.companies?.email],
    ['owner', owner?.email],
  ]);
  const name = firstFilled([
    ['company', shop.companies?.owner_name],
    ['owner', owner?.full_name],
  ]);

  return {
    phone: phone?.[0] ?? null,
    phoneSource: phone?.[1] ?? null,
    email: email?.[0] ?? null,
    emailSource: email?.[1] ?? null,
    contactName: name?.[0] ?? null,
  };
}

/**
 * Effective entitlement for one shop, mirroring getShopSubscriptionState in
 * src/lib/subscription/enforcement.ts. Kept client-side so the list stays a
 * single request: counting or resolving per shop on the server would be one
 * round trip per row.
 *
 * @param sub - Subscription row for the shop, or undefined when the shop has none.
 * @param starterLimits - Free-tier limits, read from the starter plan row.
 */
function resolveRowState(sub: Sub | undefined, starterLimits: PlanLimits): RowState {
  if (!sub) {
    return {
      hasSub: false,
      planCode: FREE_PLAN_CODE,
      planName: null,
      suspended: false,
      expired: false,
      downgraded: false,
      expiringSoon: false,
      daysRemaining: null,
      limits: starterLimits,
      overridden: { max_branches: false, max_services: false, max_staff: false, max_resources: false, max_monthly_bookings: false },
    };
  }

  const plan = sub.subscription_plans ?? null;
  const planLimits = planToLimits(plan);
  const planCode = sub.plan_code ?? plan?.code ?? FREE_PLAN_CODE;

  const expiresAt = sub.expires_at ? new Date(String(sub.expires_at)) : null;
  const validExpiry = expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null;
  const expired = Boolean(validExpiry && validExpiry.getTime() < Date.now());
  const daysRemaining = validExpiry ? Math.ceil((validExpiry.getTime() - Date.now()) / DAY_MS) : null;
  const downgraded = expired && planCode !== FREE_PLAN_CODE;

  const overridden = {
    max_branches: toNullableInt(sub.max_branches_override) !== null,
    max_services: toNullableInt(sub.max_services_override) !== null,
    max_staff: toNullableInt(sub.max_staff_override) !== null,
    max_resources: toNullableInt(sub.max_resources_override) !== null,
    max_monthly_bookings: toNullableInt(sub.max_monthly_bookings_override) !== null,
  };

  const limits: PlanLimits = downgraded
    ? starterLimits
    : {
        max_branches: toNullableInt(sub.max_branches_override) ?? planLimits.max_branches,
        max_services: toNullableInt(sub.max_services_override) ?? planLimits.max_services,
        max_staff: toNullableInt(sub.max_staff_override) ?? planLimits.max_staff,
        max_resources: toNullableInt(sub.max_resources_override) ?? planLimits.max_resources,
        max_monthly_bookings: toNullableInt(sub.max_monthly_bookings_override) ?? planLimits.max_monthly_bookings,
      };

  return {
    hasSub: true,
    planCode,
    planName: plan?.name ?? null,
    suspended: sub.is_active === false,
    expired,
    downgraded,
    expiringSoon: daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= EXPIRING_SOON_DAYS,
    daysRemaining,
    limits,
    overridden: downgraded
      ? { max_branches: false, max_services: false, max_staff: false, max_resources: false, max_monthly_bookings: false }
      : overridden,
  };
}

/** Single badge per row: the most urgent condition wins. */
function statusBadge(state: RowState): { label: string; tone: StatusTone } {
  if (state.suspended) return { label: 'ระงับการใช้งาน', tone: 'danger' };
  if (state.downgraded) return { label: 'หมดอายุ — ใช้สิทธิ์ฟรี', tone: 'danger' };
  if (!state.hasSub) return { label: 'ไม่มี subscription', tone: 'neutral' };
  if (state.expiringSoon) return { label: `ใกล้หมดอายุ (${state.daysRemaining} วัน)`, tone: 'warn' };
  return { label: 'ใช้งาน', tone: 'ok' };
}

const TONE_COLOR: Record<StatusTone, string> = {
  ok: 'var(--brand)',
  warn: '#d97706',
  danger: '#dc2626',
  neutral: 'var(--muted)',
};

function Badge({ label, tone }: { label: string; tone: StatusTone }) {
  const color = TONE_COLOR[tone];
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ color, borderColor: color, background: `color-mix(in srgb, ${color} 10%, transparent)` }}
    >
      {label}
    </span>
  );
}

/** Phone/email with a note when the value came from the company or owner account, not the shop. */
function ContactLines({ contact, showName = true }: { contact: ResolvedContact; showName?: boolean }) {
  if (!contact.phone && !contact.email) {
    return (
      <span className="text-xs" style={{ color: 'var(--muted)' }}>
        ไม่มีข้อมูลติดต่อ
      </span>
    );
  }

  const sourceTag = (source: ContactSource | null) =>
    source && CONTACT_SOURCE_LABEL[source] ? (
      <span className="ml-1" style={{ color: 'var(--muted)' }}>
        ({CONTACT_SOURCE_LABEL[source]})
      </span>
    ) : null;

  return (
    <div className="text-xs leading-relaxed">
      {showName && contact.contactName ? <div style={{ color: 'var(--text)' }}>{contact.contactName}</div> : null}
      {contact.phone ? (
        <div>
          <a href={`tel:${contact.phone}`} style={{ color: 'var(--brand)' }}>
            {contact.phone}
          </a>
          {sourceTag(contact.phoneSource)}
        </div>
      ) : null}
      {contact.email ? (
        <div>
          <a href={`mailto:${contact.email}`} style={{ color: 'var(--brand)' }}>
            {contact.email}
          </a>
          {sourceTag(contact.emailSource)}
        </div>
      ) : null}
    </div>
  );
}

/** Last login and email verification of the owner account, in one table cell. */
function AccountCell({ account }: { account: AccountState }) {
  if (!account.known) {
    return (
      <span className="text-xs" style={{ color: 'var(--muted)' }}>
        ไม่มีข้อมูลบัญชี
      </span>
    );
  }

  const signInLabel = account.neverSignedIn
    ? 'ยังไม่เคยเข้าใช้'
    : account.daysSinceSignIn === null
      ? '-'
      : relativeDayLabel(account.daysSinceSignIn);

  const signInColor = account.neverSignedIn ? TONE_COLOR.danger : account.dormant ? TONE_COLOR.warn : 'var(--text)';

  return (
    <div className="text-xs leading-relaxed whitespace-nowrap">
      <div style={{ color: signInColor }} title={account.lastSignInAt ? formatDateTime(account.lastSignInAt) : undefined}>
        {signInLabel}
      </div>
      <div className="mt-1">
        <Badge label={account.verified ? 'ยืนยันอีเมลแล้ว' : 'ยังไม่ยืนยันอีเมล'} tone={account.verified ? 'ok' : 'warn'} />
      </div>
    </div>
  );
}

/** Per-day booking load over the trailing window — the shape a monthly quota hides. */
function DailyUsagePanel({ daily }: { daily: DailyUsage }) {
  const max = daily.peak?.count ?? 0;
  const stats: Array<{ label: string; value: string; tone?: string }> = [
    { label: 'วันนี้', value: `${daily.today.toLocaleString('th-TH')} คิว` },
    { label: `เฉลี่ย/วัน (${daily.days} วัน)`, value: `${daily.averagePerDay.toFixed(1)} คิว` },
    { label: 'เฉลี่ย/วันที่มีคิว', value: `${daily.averagePerActiveDay.toFixed(1)} คิว` },
    {
      label: 'พีคสูงสุด',
      value: daily.peak ? `${daily.peak.count.toLocaleString('th-TH')} คิว (${daily.peak.date.slice(5)})` : '-',
      tone: TONE_COLOR.warn,
    },
    { label: `รวม ${daily.days} วัน`, value: `${daily.total.toLocaleString('th-TH')} คิว` },
    { label: 'วันที่มีคิว', value: `${daily.activeDays}/${daily.days} วัน` },
  ];

  return (
    <div>
      <div className="grid gap-x-4 gap-y-2 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="text-sm">
            <div className="text-xs" style={{ color: 'var(--muted)' }}>
              {s.label}
            </div>
            <div style={{ color: s.tone ?? 'var(--text)', fontWeight: 600 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {max > 0 ? (
        <div className="mt-3">
          <div className="flex h-16 items-end gap-[2px]">
            {daily.series.map((point) => (
              <div
                key={point.date}
                className="flex-1 rounded-sm"
                title={`${point.date}: ${point.count} คิว`}
                style={{
                  height: `${Math.max(point.count === 0 ? 2 : 8, (point.count / max) * 100)}%`,
                  background: point.count === 0 ? 'var(--line)' : 'var(--brand)',
                  opacity: point.count === 0 ? 1 : 0.35 + 0.65 * (point.count / max),
                }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs" style={{ color: 'var(--muted)' }}>
            <span>{daily.series[0]?.date.slice(5)}</span>
            <span>{daily.series[daily.series.length - 1]?.date.slice(5)}</span>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
          ยังไม่มีคิวในช่วง {daily.days} วันล่าสุด
        </p>
      )}
    </div>
  );
}

function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: ReactNode }) {
  return (
    <label className={className}>
      <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
        {label}
      </span>
      {children}
      {hint ? (
        <span className="mt-1 block text-xs" style={{ color: 'var(--muted)' }}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function ShopSubscriptionsCrud() {
  const { push } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [owners, setOwners] = useState<OwnerContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Shop | null>(null);
  const [saving, setSaving] = useState(false);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [draft, setDraft] = useState<Record<string, string | boolean>>({
    shop_id: '',
    plan_id: '',
    expires_at: '',
    is_active: true,
    max_branches_override: '',
    max_services_override: '',
    max_staff_override: '',
    max_resources_override: '',
    max_monthly_bookings_override: '',
    note: '',
  });

  const subMap = useMemo(() => new Map(subs.map((s) => [s.shop_id, s])), [subs]);
  const ownerMap = useMemo(() => new Map(owners.map((o) => [o.shop_id, o])), [owners]);

  const starterLimits = useMemo(
    () => planToLimits(plans.find((p) => p.code === FREE_PLAN_CODE) ?? null),
    [plans],
  );

  const rows = useMemo(
    () =>
      shops.map((shop) => {
        const sub = subMap.get(shop.id);
        const owner = ownerMap.get(shop.id);
        return {
          shop,
          sub,
          state: resolveRowState(sub, starterLimits),
          contact: resolveContact(shop, owner),
          account: resolveAccountState(owner),
        };
      }),
    [shops, subMap, ownerMap, starterLimits],
  );

  const paged = useMemo(() => rows.slice((page - 1) * rowsPerPage, page * rowsPerPage), [rows, page, rowsPerPage]);

  const summary = useMemo(() => {
    const byPlan = new Map<string, number>();
    let suspended = 0;
    let expired = 0;
    let expiringSoon = 0;
    let noSub = 0;
    let noContact = 0;
    let unverified = 0;
    let neverSignedIn = 0;
    let dormant = 0;

    rows.forEach(({ state, contact, account }) => {
      if (!contact.phone && !contact.email) noContact += 1;
      if (account.known && !account.verified) unverified += 1;
      if (account.neverSignedIn) neverSignedIn += 1;
      if (account.dormant) dormant += 1;
      const key = state.hasSub ? state.planCode : 'ไม่มี subscription';
      byPlan.set(key, (byPlan.get(key) ?? 0) + 1);
      if (state.suspended) suspended += 1;
      if (state.downgraded) expired += 1;
      if (state.expiringSoon) expiringSoon += 1;
      if (!state.hasSub) noSub += 1;
    });

    return {
      total: rows.length,
      byPlan: [...byPlan.entries()].sort((a, b) => b[1] - a[1]),
      suspended,
      expired,
      expiringSoon,
      noSub,
      noContact,
      unverified,
      neverSignedIn,
      dormant,
    };
  }, [rows]);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === String(draft.plan_id ?? '')) ?? null,
    [plans, draft.plan_id],
  );
  const selectedPlanLimits = useMemo(() => planToLimits(selectedPlan), [selectedPlan]);

  /** Overrides tighter than what the shop already uses would strand existing data. */
  const overrideWarnings = useMemo(() => {
    if (!usage) return [];
    return LIMIT_FIELDS.flatMap((field) => {
      const entered = toNullableInt(draft[field.overrideKey]);
      const used = usage.usage[field.usageKey];
      if (entered === null || used <= entered) return [];
      return [`${field.label}: กำหนด ${entered} แต่ใช้อยู่แล้ว ${used}`];
    });
  }, [usage, draft]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/shop-subscriptions', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) {
        push(json.error ?? 'โหลดข้อมูลแพ็กเกจไม่สำเร็จ', 'error');
        return;
      }
      setPlans(json.data?.plans ?? []);
      setShops(json.data?.shops ?? []);
      setSubs(json.data?.subscriptions ?? []);
      setOwners(json.data?.owners ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  /**
   * Usage is fetched per shop when the drawer opens: counting every shop in the
   * list endpoint would be five count queries per row.
   */
  async function loadUsage(shopId: string) {
    setUsage(null);
    setUsageLoading(true);
    try {
      const res = await fetch(`/api/admin/shop-subscriptions/usage?shop_id=${encodeURIComponent(shopId)}`, { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) setUsage((json.data ?? null) as UsageResponse | null);
    } catch {
      // Usage is informational — a failed load must not block editing the plan.
    } finally {
      setUsageLoading(false);
    }
  }

  function openEdit(shop: Shop) {
    const sub = subMap.get(shop.id);
    setEditing(shop);
    setDraft({
      shop_id: shop.id,
      plan_id: sub?.plan_id ?? '',
      expires_at: sub?.expires_at ? String(sub.expires_at).slice(0, 10) : '',
      is_active: sub?.is_active ?? true,
      max_branches_override: sub?.max_branches_override != null ? String(sub.max_branches_override) : '',
      max_services_override: sub?.max_services_override != null ? String(sub.max_services_override) : '',
      max_staff_override: sub?.max_staff_override != null ? String(sub.max_staff_override) : '',
      max_resources_override: sub?.max_resources_override != null ? String(sub.max_resources_override) : '',
      max_monthly_bookings_override: sub?.max_monthly_bookings_override != null ? String(sub.max_monthly_bookings_override) : '',
      note: sub?.note ?? '',
    });
    setDrawerOpen(true);
    void loadUsage(shop.id);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditing(null);
    setUsage(null);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft.shop_id) return;
    setSaving(true);
    const payload = {
      shop_id: String(draft.shop_id),
      plan_id: draft.plan_id ? String(draft.plan_id) : null,
      // Keep plan_code in step with plan_id: the expiry cron and upgrade
      // requests read plan_code, not the join.
      plan_code: selectedPlan?.code ?? null,
      expires_at: draft.expires_at ? `${String(draft.expires_at)}T23:59:59+07:00` : null,
      is_active: Boolean(draft.is_active),
      max_branches_override: draft.max_branches_override ? Number(draft.max_branches_override) : null,
      max_services_override: draft.max_services_override ? Number(draft.max_services_override) : null,
      max_staff_override: draft.max_staff_override ? Number(draft.max_staff_override) : null,
      max_resources_override: draft.max_resources_override ? Number(draft.max_resources_override) : null,
      max_monthly_bookings_override: draft.max_monthly_bookings_override ? Number(draft.max_monthly_bookings_override) : null,
      note: draft.note ? String(draft.note) : null,
    };

    const res = await fetch('/api/admin/shop-subscriptions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) return push(json.error ?? 'บันทึกแพ็กเกจไม่สำเร็จ', 'error');

    push('บันทึกแพ็กเกจแล้ว');
    closeDrawer();
    void load();
  }

  const editingSub = editing ? subMap.get(editing.id) : undefined;
  const editingAccount = resolveAccountState(editing ? ownerMap.get(editing.id) : undefined);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <p className="text-sm" style={{ color: 'var(--text)' }}>
          Super Admin: จัดการสิทธิ์ร้านค้า, จำนวนสาขา, และวันหมดอายุแพ็กเกจ
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs" style={{ color: 'var(--muted)' }}>
          <span>
            ร้านทั้งหมด <strong style={{ color: 'var(--text)' }}>{summary.total}</strong>
          </span>
          {summary.byPlan.map(([code, count]) => (
            <span key={code}>
              {code} <strong style={{ color: 'var(--text)' }}>{count}</strong>
            </span>
          ))}
          <span>
            ใกล้หมดอายุ ≤{EXPIRING_SOON_DAYS} วัน{' '}
            <strong style={{ color: summary.expiringSoon > 0 ? TONE_COLOR.warn : 'var(--text)' }}>{summary.expiringSoon}</strong>
          </span>
          <span>
            หมดอายุแล้ว <strong style={{ color: summary.expired > 0 ? TONE_COLOR.danger : 'var(--text)' }}>{summary.expired}</strong>
          </span>
          <span>
            ระงับ <strong style={{ color: summary.suspended > 0 ? TONE_COLOR.danger : 'var(--text)' }}>{summary.suspended}</strong>
          </span>
          <span>
            ไม่มี subscription <strong style={{ color: 'var(--text)' }}>{summary.noSub}</strong>
          </span>
          <span>
            ไม่มีข้อมูลติดต่อ{' '}
            <strong style={{ color: summary.noContact > 0 ? TONE_COLOR.warn : 'var(--text)' }}>{summary.noContact}</strong>
          </span>
          <span>
            ยังไม่ยืนยันอีเมล{' '}
            <strong style={{ color: summary.unverified > 0 ? TONE_COLOR.warn : 'var(--text)' }}>{summary.unverified}</strong>
          </span>
          <span>
            ยังไม่เคยเข้าใช้{' '}
            <strong style={{ color: summary.neverSignedIn > 0 ? TONE_COLOR.danger : 'var(--text)' }}>{summary.neverSignedIn}</strong>
          </span>
          <span>
            เงียบ ≥{DORMANT_DAYS} วัน{' '}
            <strong style={{ color: summary.dormant > 0 ? TONE_COLOR.warn : 'var(--text)' }}>{summary.dormant}</strong>
          </span>
        </div>
      </div>

      <div className="card p-4">
        {loading ? (
          <p className="px-2 py-6 text-sm" style={{ color: 'var(--muted)' }}>
            กำลังโหลดข้อมูลแพ็กเกจ...
          </p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon="🏪"
            title="ยังไม่มีร้านค้าในระบบ"
            description="เมื่อมีร้านสมัครเข้ามา จะแสดงที่นี่พร้อมสิทธิ์แพ็กเกจที่กำหนดได้"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr style={{ color: 'var(--muted)' }}>
                  <th className="px-2 py-2 text-left">ร้านค้า</th>
                  <th className="px-2 py-2 text-left">บริษัท</th>
                  <th className="px-2 py-2 text-left">ติดต่อ</th>
                  <th className="px-2 py-2 text-left">เข้าใช้ล่าสุด / ยืนยันบัญชี</th>
                  <th className="px-2 py-2 text-left">แพ็กเกจ</th>
                  <th className="px-2 py-2 text-left">สิทธิ์ที่มีผลจริง</th>
                  <th className="px-2 py-2 text-left">หมดอายุ</th>
                  <th className="px-2 py-2 text-left">สถานะ</th>
                  <th className="px-2 py-2 text-left">หมายเหตุ</th>
                  <th className="px-2 py-2 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(({ shop, sub, state, contact, account }) => {
                  const badge = statusBadge(state);
                  return (
                    <tr key={shop.id} className="border-t align-top" style={{ borderColor: 'var(--line)' }}>
                      <td className="px-2 py-2">
                        <div className="font-medium" style={{ color: 'var(--text)' }}>
                          {shop.name}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--muted)' }}>
                          {shop.shop_key}
                        </div>
                      </td>
                      <td className="px-2 py-2">{shop.companies?.name ?? '-'}</td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <ContactLines contact={contact} />
                      </td>
                      <td className="px-2 py-2">
                        <AccountCell account={account} />
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <div style={{ color: 'var(--text)' }}>{state.planName ?? (state.hasSub ? state.planCode : 'ยังไม่กำหนด')}</div>
                        <div className="text-xs" style={{ color: 'var(--muted)' }}>
                          {state.hasSub ? state.planCode : `ใช้สิทธิ์ ${FREE_PLAN_CODE}`}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs whitespace-nowrap">
                          {LIMIT_FIELDS.map((field) => {
                            const overridden = state.overridden[field.limitKey];
                            return (
                              <span key={field.limitKey} title={overridden ? 'กำหนดเฉพาะร้านนี้ (override)' : 'ค่าจากแพ็กเกจ'}>
                                <span style={{ color: 'var(--muted)' }}>{field.shortLabel} </span>
                                <span
                                  style={{ color: overridden ? 'var(--brand)' : 'var(--text)', fontWeight: overridden ? 700 : 500 }}
                                >
                                  {formatLimit(state.limits[field.limitKey])}
                                  {overridden ? '*' : ''}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                        {state.downgraded ? (
                          <div className="mt-1 text-xs" style={{ color: TONE_COLOR.danger }}>
                            ใช้สิทธิ์ {FREE_PLAN_CODE} เพราะแพ็กเกจหมดอายุ
                          </div>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <div style={{ color: 'var(--text)' }}>{sub?.expires_at ? String(sub.expires_at).slice(0, 10) : '-'}</div>
                        <div className="text-xs" style={{ color: 'var(--muted)' }}>
                          {state.daysRemaining === null
                            ? 'ไม่มีวันหมดอายุ'
                            : state.daysRemaining < 0
                              ? `เลยกำหนด ${Math.abs(state.daysRemaining)} วัน`
                              : `เหลือ ${state.daysRemaining} วัน`}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <Badge label={badge.label} tone={badge.tone} />
                      </td>
                      <td className="px-2 py-2 text-xs" style={{ color: 'var(--muted)' }}>
                        {sub?.note ? (
                          <span title={sub.note}>{sub.note.length > 40 ? `${sub.note.slice(0, 40)}…` : sub.note}</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <ActionIconGroup
                          actions={[
                            {
                              key: 'edit',
                              icon: <EditOutlinedIcon fontSize="small" />,
                              labelKey: 'common.edit',
                              fallbackLabel: 'Edit',
                              onClick: () => openEdit(shop),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <TablePaginationControls
              page={page}
              rowsPerPage={rowsPerPage}
              total={rows.length}
              onPageChange={setPage}
              onRowsPerPageChange={(v) => {
                setRowsPerPage(v);
                setPage(1);
              }}
            />
          </div>
        )}
      </div>

      {drawerOpen && editing ? (
        <>
          <button className="fixed inset-0 z-40 bg-slate-900/30" onClick={closeDrawer} aria-label="close" />
          <aside
            className="fixed right-0 top-0 z-50 h-dvh w-full overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:w-[60%]"
            style={{ background: 'var(--surface)' }}
          >
            <div className="mb-4 flex items-start justify-between gap-3 border-b pb-3" style={{ borderColor: 'var(--line)' }}>
              <div>
                <h4 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
                  {editing.name}
                </h4>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  {editing.shop_key}
                  {editing.companies?.name ? ` • ${editing.companies.name}` : ''}
                </p>
                <div className="mt-1">
                  <ContactLines contact={resolveContact(editing, ownerMap.get(editing.id))} />
                </div>
                {editingAccount.known ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                    <Badge
                      label={editingAccount.verified ? 'ยืนยันอีเมลแล้ว' : 'ยังไม่ยืนยันอีเมล'}
                      tone={editingAccount.verified ? 'ok' : 'warn'}
                    />
                    <span>
                      เข้าใช้ล่าสุด:{' '}
                      <strong style={{ color: editingAccount.neverSignedIn ? TONE_COLOR.danger : 'var(--text)' }}>
                        {editingAccount.neverSignedIn ? 'ยังไม่เคยเข้าใช้' : formatDateTime(editingAccount.lastSignInAt)}
                      </strong>
                    </span>
                    <span>สมัครเมื่อ: {formatDate(ownerMap.get(editing.id)?.account_created_at)}</span>
                  </div>
                ) : null}
              </div>
              <button className="btn-outline" onClick={closeDrawer}>
                ปิด
              </button>
            </div>

            <div className="mb-4 rounded-xl border p-3" style={{ borderColor: 'var(--line)', background: 'var(--surface-soft)' }}>
              <p className="mb-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>
                การใช้งานจริงเทียบกับสิทธิ์ที่มีผล
              </p>
              {usageLoading ? (
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  กำลังโหลดการใช้งาน...
                </p>
              ) : usage ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {LIMIT_FIELDS.map((field) => {
                    const used = usage.usage[field.usageKey];
                    const limit = usage.effective.limits[field.limitKey];
                    const nearFull = limit !== null && limit > 0 && used / limit >= 0.8;
                    return (
                      <div key={field.limitKey} className="flex items-baseline justify-between text-sm">
                        <span style={{ color: 'var(--muted)' }}>{field.label}</span>
                        <span style={{ color: nearFull ? TONE_COLOR.warn : 'var(--text)' }}>
                          {used.toLocaleString('th-TH')} / {limit === null ? 'ไม่จำกัด' : limit.toLocaleString('th-TH')}
                        </span>
                      </div>
                    );
                  })}
                  <p className="text-xs sm:col-span-2" style={{ color: 'var(--muted)' }}>
                    สิทธิ์ที่มีผลตอนนี้: {usage.effective.plan_code ?? '-'}
                    {usage.effective.downgraded ? ' (หมดอายุ — ใช้สิทธิ์ฟรี)' : ''}
                    {usage.effective.active ? '' : ' • ถูกระงับ'}
                  </p>
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  โหลดการใช้งานไม่สำเร็จ — ยังแก้แพ็กเกจได้ตามปกติ
                </p>
              )}
            </div>

            <div className="mb-4 rounded-xl border p-3" style={{ borderColor: 'var(--line)', background: 'var(--surface-soft)' }}>
              <p className="mb-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>
                การใช้งานต่อวัน (ใช้ประเมินแผน scale)
              </p>
              {usageLoading ? (
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  กำลังโหลดการใช้งานรายวัน...
                </p>
              ) : usage?.daily ? (
                <DailyUsagePanel daily={usage.daily} />
              ) : (
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  ไม่มีข้อมูลการใช้งานรายวัน
                </p>
              )}
            </div>

            <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
              <Field
                label="แพ็กเกจ"
                className="sm:col-span-2"
                hint={
                  selectedPlan
                    ? `สิทธิ์ของแพ็กเกจนี้: ${LIMIT_FIELDS.map((f) => `${f.shortLabel} ${formatLimit(selectedPlanLimits[f.limitKey])}`).join(' · ')}`
                    : 'ไม่ผูก plan = ไม่จำกัดสิทธิ์ทุกรายการ (ใช้กับลูกค้า enterprise ที่ตกลงเป็นกรณีพิเศษ)'
                }
              >
                <select
                  className="input"
                  value={String(draft.plan_id ?? '')}
                  onChange={(e) => setDraft((p) => ({ ...p, plan_id: e.target.value }))}
                >
                  <option value="">ไม่ผูก plan (ไม่จำกัด)</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="วันหมดอายุ" hint="ปล่อยว่าง = ไม่มีวันหมดอายุ">
                <input
                  className="input"
                  type="date"
                  value={String(draft.expires_at ?? '')}
                  onChange={(e) => setDraft((p) => ({ ...p, expires_at: e.target.value }))}
                />
              </Field>

              <div className="flex items-end">
                <button
                  type="button"
                  className="btn-outline"
                  disabled={!draft.expires_at}
                  onClick={() => setDraft((p) => ({ ...p, expires_at: '' }))}
                >
                  ล้างวันหมดอายุ
                </button>
              </div>

              <p className="text-xs sm:col-span-2" style={{ color: 'var(--muted)' }}>
                Override ด้านล่าง: ปล่อยว่าง = ใช้ค่าของแพ็กเกจ กรอกตัวเลข = ใช้เฉพาะร้านนี้
              </p>

              {LIMIT_FIELDS.map((field) => (
                <Field key={field.overrideKey} label={`Override ${field.label}`}>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    placeholder={`ตามแพ็กเกจ: ${selectedPlan ? formatLimit(selectedPlanLimits[field.limitKey]) : 'ไม่จำกัด'}`}
                    value={String(draft[field.overrideKey] ?? '')}
                    onChange={(e) => setDraft((p) => ({ ...p, [field.overrideKey]: e.target.value }))}
                  />
                </Field>
              ))}

              {overrideWarnings.length > 0 ? (
                <div
                  className="rounded-xl border p-3 text-xs sm:col-span-2"
                  style={{ borderColor: TONE_COLOR.warn, color: TONE_COLOR.warn }}
                >
                  <p className="font-medium">สิทธิ์ที่กำหนดน้อยกว่าที่ร้านใช้อยู่แล้ว</p>
                  <ul className="mt-1 list-disc pl-4">
                    {overrideWarnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                  <p className="mt-1">ข้อมูลเดิมไม่ถูกลบ แต่ร้านจะสร้างรายการใหม่ไม่ได้จนกว่าจะลดจำนวนลง</p>
                </div>
              ) : null}

              <Field label="หมายเหตุ" className="sm:col-span-2" hint="ไม่เกิน 500 ตัวอักษร — บันทึกข้อตกลงกับลูกค้าไว้ที่นี่">
                <textarea
                  className="input min-h-20"
                  maxLength={500}
                  value={String(draft.note ?? '')}
                  onChange={(e) => setDraft((p) => ({ ...p, note: e.target.value }))}
                />
              </Field>

              <label className="flex items-center gap-2 text-sm sm:col-span-2" style={{ color: 'var(--text)' }}>
                <input
                  type="checkbox"
                  checked={Boolean(draft.is_active)}
                  onChange={(e) => setDraft((p) => ({ ...p, is_active: e.target.checked }))}
                />
                เปิดใช้งาน subscription (ปิด = ระงับร้าน ลูกค้าจองไม่ได้)
              </label>

              <div className="text-xs sm:col-span-2" style={{ color: 'var(--muted)' }}>
                เริ่มใช้: {formatDate(editingSub?.starts_at)} • แก้ไขล่าสุด: {formatDate(editingSub?.updated_at)}
              </div>

              <div className="flex gap-2 pt-2 sm:col-span-2">
                <button className="btn-primary" disabled={saving}>
                  {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
                <button type="button" className="btn-outline" onClick={closeDrawer}>
                  ยกเลิก
                </button>
              </div>
            </form>
          </aside>
        </>
      ) : null}
    </div>
  );
}
