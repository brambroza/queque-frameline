'use client';

import { useEffect, useState } from 'react';
import { useUpgrade, type UpgradeSource } from '@/components/subscription/upgrade-provider';

type Limits = {
  max_branches: number | null;
  max_services: number | null;
  max_staff: number | null;
  max_resources: number | null;
  max_monthly_bookings: number | null;
};

type Usage = {
  branches: number;
  services: number;
  staff: number;
  resources: number;
  bookings: number;
};

type CurrentSubscription = {
  data: {
    plan_code?: string | null;
    expires_at?: string | null;
    is_active?: boolean;
    subscription_plans?: { code?: string | null; name?: string | null } | null;
  } | null;
  effective?: {
    plan_code: string | null;
    limits: Limits;
    active: boolean;
    downgraded: boolean;
    days_remaining: number | null;
  };
  usage?: Usage;
};

const ROWS: Array<{ label: string; usageKey: keyof Usage; limitKey: keyof Limits }> = [
  { label: 'สาขา', usageKey: 'branches', limitKey: 'max_branches' },
  { label: 'บริการ', usageKey: 'services', limitKey: 'max_services' },
  { label: 'พนักงาน', usageKey: 'staff', limitKey: 'max_staff' },
  { label: 'คิวเดือนนี้', usageKey: 'bookings', limitKey: 'max_monthly_bookings' },
];

/**
 * Shows the shop's plan, how much of it is already consumed, and the upgrade
 * action. Usage is visible before the wall is hit — a shop owner who can see
 * "48 / 50 คิว" has a reason to upgrade that an error toast never gives them.
 *
 * @param source - Recorded on the upgrade request so we know which surface converted.
 */
export function PlanCard({ source = 'settings' }: { source?: UpgradeSource }) {
  const { openUpgrade } = useUpgrade();
  const [state, setState] = useState<CurrentSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/shop-subscription/current', { cache: 'no-store' });
        const body = (await res.json()) as CurrentSubscription;
        if (!cancelled && res.ok) setState(body);
      } catch {
        // Plan display is informational; a failed load must not break the page.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="portal-panel p-4 text-sm" style={{ color: 'var(--muted)' }}>
        กำลังโหลดข้อมูลแพ็กเกจ...
      </div>
    );
  }

  const planName = state?.data?.subscription_plans?.name ?? state?.effective?.plan_code ?? 'Starter';
  const limits = state?.effective?.limits;
  const usage = state?.usage;
  const daysRemaining = state?.effective?.days_remaining ?? null;
  const downgraded = state?.effective?.downgraded ?? false;
  const suspended = state?.effective?.active === false;

  return (
    <div className="portal-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
            แพ็กเกจปัจจุบัน
          </p>
          <p className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
            {planName}
          </p>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--muted)' }}>
            {suspended
              ? 'สถานะ: ระงับการใช้งาน — กรุณาติดต่อทีมงาน'
              : downgraded
                ? 'แพ็กเกจหมดอายุแล้ว ระบบยังใช้งานต่อได้ในสิทธิ์แบบฟรี'
                : daysRemaining === null
                  ? 'ใช้งานได้ต่อเนื่อง ไม่มีวันหมดอายุ'
                  : `เหลืออีก ${daysRemaining} วัน`}
          </p>
        </div>
        <button className="btn-primary" onClick={() => openUpgrade(source)}>
          อัปเกรดแพ็กเกจ
        </button>
      </div>

      {limits && usage && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {ROWS.map((row) => {
            const limit = limits[row.limitKey];
            const used = usage[row.usageKey];
            const unlimited = limit === null;
            const ratio = unlimited ? 0 : Math.min(1, limit === 0 ? 1 : used / limit);
            const nearFull = !unlimited && ratio >= 0.8;

            return (
              <div key={row.label}>
                <div className="flex items-baseline justify-between text-sm">
                  <span style={{ color: 'var(--muted)' }}>{row.label}</span>
                  <span style={{ color: nearFull ? '#d97706' : 'var(--text)' }}>
                    {used} / {unlimited ? 'ไม่จำกัด' : limit}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/60">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${unlimited ? 4 : Math.round(ratio * 100)}%`,
                      backgroundColor: nearFull ? '#d97706' : 'var(--brand)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
