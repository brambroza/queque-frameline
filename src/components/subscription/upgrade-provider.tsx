'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { track } from '@/lib/analytics/track';

export type PaywallDetail = {
  kind?: string;
  feature?: string;
  feature_label?: string;
  limit?: number;
  plan_code?: string | null;
  message?: string;
};

export type UpgradeSource = 'paywall' | 'settings' | 'portal' | 'pricing_page';

type UpgradeContextValue = {
  /** Opens the upgrade dialog with the quota detail returned by a 402 response. */
  openPaywall: (detail: PaywallDetail) => void;
  /** Opens the upgrade dialog from a deliberate click (no quota context). */
  openUpgrade: (source?: UpgradeSource) => void;
};

const UpgradeContext = createContext<UpgradeContextValue | null>(null);

const PLAN_OPTIONS = [
  {
    code: 'professional',
    name: 'Professional',
    price: '990 บาท/เดือน',
    items: ['5 สาขา', 'ไม่จำกัดบริการ', '2,000 คิว/เดือน', 'LINE Auto Reply'],
  },
  {
    code: 'business',
    name: 'Business',
    price: '2,490 บาท/เดือน',
    items: ['หลายร้าน / หลายสาขา', '10,000 คิว/เดือน', 'Chat Inbox', 'Advanced Reports'],
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    price: 'ติดต่อฝ่ายขาย',
    items: ['ปรับแต่งตามองค์กร', 'Dedicated support', 'SLA'],
  },
] as const;

/**
 * Reads a quota payload out of a failed API response.
 *
 * @param res - The fetch Response (a quota wall answers with HTTP 402).
 * @param body - The already-parsed JSON body, to avoid consuming the stream twice.
 * @returns The paywall detail, or null when this was an ordinary error.
 */
export function readPaywallDetail(res: Response, body: unknown): PaywallDetail | null {
  if (res.status !== 402 && res.status !== 403) return null;
  if (!body || typeof body !== 'object') return null;
  const detail = (body as { subscription?: PaywallDetail }).subscription;
  if (!detail || typeof detail !== 'object') return null;
  return detail;
}

export function UpgradeProvider({ children }: { children: React.ReactNode }) {
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<PaywallDetail | null>(null);
  const [source, setSource] = useState<UpgradeSource>('portal');
  const [selected, setSelected] = useState<string>('professional');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const reset = useCallback(() => {
    setDetail(null);
    setNote('');
    setSelected('professional');
    setDone(false);
  }, []);

  const openPaywall = useCallback((next: PaywallDetail) => {
    track('quota_wall_hit', { feature: next.feature, limit: next.limit, plan_code: next.plan_code });
    setDetail(next);
    setSource('paywall');
    setDone(false);
    setOpen(true);
  }, []);

  const openUpgrade = useCallback((next: UpgradeSource = 'portal') => {
    track('upgrade_clicked', { source: next });
    setDetail(null);
    setSource(next);
    setDone(false);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    reset();
  }, [reset]);

  const submit = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/upgrade-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requested_plan_code: selected,
          source,
          note: note.trim() || (detail?.feature_label ? `ชนลิมิต${detail.feature_label}` : undefined),
        }),
      });
      const body = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        push(body.error ?? 'ส่งคำขอไม่สำเร็จ', 'error');
        return;
      }
      track('upgrade_requested', { plan: selected, source });
      setDone(true);
      push(body.message ?? 'ส่งคำขอเรียบร้อย', 'success');
    } catch {
      push('เชื่อมต่อไม่ได้ กรุณาลองใหม่', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [detail, note, push, selected, source]);

  const value = useMemo(() => ({ openPaywall, openUpgrade }), [openPaywall, openUpgrade]);

  return (
    <UpgradeContext.Provider value={value}>
      {children}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
          <div className="portal-panel max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl p-5 shadow-xl sm:rounded-2xl">
            {done ? (
              <div className="space-y-4 py-6 text-center">
                <p className="text-lg font-semibold" style={{ color: 'var(--text)' }}>ได้รับคำขอแล้ว</p>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  ทีมงานจะติดต่อกลับภายใน 1 วันทำการ เพื่อยืนยันแพ็กเกจและวิธีชำระเงิน
                </p>
                <button className="btn-primary" onClick={close}>
                  ปิด
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <p className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
                    {detail ? 'ถึงลิมิตของแพ็กเกจปัจจุบันแล้ว' : 'อัปเกรดแพ็กเกจ'}
                  </p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                    {detail?.message ??
                      'เลือกแพ็กเกจที่ต้องการ ทีมงานจะติดต่อกลับเพื่อยืนยันและแจ้งวิธีชำระเงิน'}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {PLAN_OPTIONS.map((plan) => {
                    const active = selected === plan.code;
                    return (
                      <button
                        key={plan.code}
                        type="button"
                        onClick={() => setSelected(plan.code)}
                        className={`rounded-xl border p-3 text-left transition ${
                          active ? 'border-emerald-500 bg-emerald-500/10' : 'hover:border-emerald-400'
                        }`}
                      >
                        <p className="font-semibold" style={{ color: 'var(--text)' }}>{plan.name}</p>
                        <p className="mt-0.5 text-sm text-emerald-700">{plan.price}</p>
                        <ul className="mt-2 space-y-1 text-xs" style={{ color: 'var(--muted)' }}>
                          {plan.items.map((i) => (
                            <li key={i}>• {i}</li>
                          ))}
                        </ul>
                      </button>
                    );
                  })}
                </div>

                <label className="mt-4 block text-sm">
                  <span className="mb-1 block" style={{ color: 'var(--muted)' }}>ข้อความถึงทีมงาน (ไม่บังคับ)</span>
                  <textarea
                    className="input min-h-20"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="เช่น ต้องการเปิดใช้ 3 สาขา ภายในเดือนนี้"
                  />
                </label>

                <div className="mt-5 flex justify-end gap-2">
                  <button className="btn-outline" onClick={close} disabled={submitting}>
                    ยกเลิก
                  </button>
                  <button className="btn-primary" onClick={() => void submit()} disabled={submitting}>
                    {submitting ? 'กำลังส่ง...' : 'ส่งคำขออัปเกรด'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </UpgradeContext.Provider>
  );
}

export function useUpgrade() {
  const ctx = useContext(UpgradeContext);
  if (!ctx) throw new Error('useUpgrade must be used within UpgradeProvider');
  return ctx;
}
