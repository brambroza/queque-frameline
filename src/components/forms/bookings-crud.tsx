'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Stack } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { PageHeader } from '@/components/shared/page-header';
import { useToast } from '@/components/ui/toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useBranchScope } from '@/components/layout/branch-scope-provider';
import { getTodayISOInBangkok } from '@/lib/utils/date-format';
import { BookingsFilterBar, dateForRange, type BookingsFilter } from '@/components/bookings/bookings-filter-bar';
import { BookingsTable } from '@/components/bookings/bookings-table';
import { BookingScheduleDialog, type ScheduleChanges, type ScheduleDraft } from '@/components/bookings/booking-schedule-dialog';
import { BookingCreateDrawer, type CreateDraft, type CreateResult } from '@/components/bookings/booking-create-drawer';
import { BookingEditDrawer } from '@/components/bookings/booking-edit-drawer';
import { ApproveDialog, CancelDialog, CompleteDialog, PaymentDialog, type BookingSignatures, type PaymentTarget } from '@/components/bookings/booking-action-dialogs';
import type { ItemMinutesRule } from '@/lib/booking/suggest-minutes';
import { type BookingRow, type Dock, type VehicleType } from '@/components/bookings/booking-types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Initial filter: `?date=YYYY-MM-DD` deep-links from the dashboard into one day. */
function initialFilter(): BookingsFilter {
  const today = getTodayISOInBangkok();
  const base: BookingsFilter = { range: 'today', date: today, status: '', direction: '', resource: '', search: '' };
  if (typeof window === 'undefined') return base;
  const sp = new URLSearchParams(window.location.search);
  // Coming from a document: its queues can be on any day.
  if (sp.get('doc')) return { ...base, range: 'all', date: '' };
  const d = sp.get('date') ?? '';
  if (!ISO_DATE.test(d)) return base;
  if (d === today) return base;
  return { ...base, range: 'custom', date: d };
}

type PatchResult = { ok: boolean; error?: string; doNumber: string | null; autoCalled: string[] };

async function patchBooking(body: Record<string, unknown>): Promise<PatchResult> {
  const res = await fetch('/api/bookings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string; data?: { do_number?: string | null; auto_called?: string[] } };
  return { ok: res.ok, error: j.error, doNumber: j.data?.do_number ?? null, autoCalled: j.data?.auto_called ?? [] };
}

/**
 * Bookings list page: filter strip, table with inline actions, create drawer,
 * detail drawer and the move dialog (date / time / resource in one step).
 */
export function BookingsCrud({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation('bookings');
  const { push } = useToast();
  // Topbar branch selection narrows the list; the API enforces the caller's own scope.
  const { branches, branchId, withBranch } = useBranchScope();

  const [rows, setRows] = useState<BookingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const [filter, setFilter] = useState<BookingsFilter>(initialFilter);
  const [debouncedSearch, setDebouncedSearch] = useState(filter.search);
  const [documentId] = useState(() => (typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('doc') ?? ''));

  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [resources, setResources] = useState<Dock[]>([]);
  const [siteName, setSiteName] = useState('Fameline');
  const [itemMinutes, setItemMinutes] = useState<ItemMinutesRule | undefined>(undefined);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<CreateResult | null>(null);
  const [editTarget, setEditTarget] = useState<BookingRow | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<BookingRow | null>(null);
  const [approveTarget, setApproveTarget] = useState<BookingRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<BookingRow | null>(null);
  const [completeTarget, setCompleteTarget] = useState<BookingRow | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);
  const [saving, setSaving] = useState(false);

  // Search is typed continuously; wait for a pause before hitting the API.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(filter.search.trim()), 300);
    return () => clearTimeout(id);
  }, [filter.search]);

  const queryDate = filter.range === 'custom' ? filter.date : dateForRange(filter.range, filter.date);
  const queryString = useMemo(() => {
    const params = withBranch(new URLSearchParams({ page: String(page), page_size: String(pageSize) }));
    if (queryDate) params.set('date', queryDate);
    if (filter.status) params.set('status', filter.status);
    if (filter.direction) params.set('direction', filter.direction);
    if (filter.resource) params.set('resource_id', filter.resource);
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (documentId) params.set('document_id', documentId);
    return params.toString();
  }, [withBranch, page, pageSize, queryDate, filter.status, filter.direction, filter.resource, debouncedSearch, documentId]);

  // Any filter change goes back to page 1.
  useEffect(() => { setPage(1); }, [queryDate, filter.status, filter.direction, filter.resource, debouncedSearch, pageSize, branchId]);

  useEffect(() => {
    if (filter.range === 'custom' && !ISO_DATE.test(filter.date)) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/bookings?${queryString}`, { cache: 'no-store', signal: controller.signal });
        const j = (await res.json()) as { data?: BookingRow[]; pagination?: { total: number }; error?: string };
        if (!res.ok) throw new Error(j.error ?? t('load_failed', 'โหลดรายการคิวไม่สำเร็จ'));
        setRows(j.data ?? []);
        setTotal(j.pagination?.total ?? 0);
      } catch (e) {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : t('load_failed', 'โหลดรายการคิวไม่สำเร็จ'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [queryString, reloadKey, filter.range, filter.date, t]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    (async () => {
      try {
        const [sRes, rRes, shopRes, siteRes] = await Promise.all([
          fetch('/api/services?page_size=200', { cache: 'no-store' }),
          fetch('/api/resources?page_size=500', { cache: 'no-store' }),
          fetch('/api/shop-profile', { cache: 'no-store' }),
          fetch('/api/site-settings', { cache: 'no-store' }),
        ]);
        const [sv, r, shop, site] = (await Promise.all([sRes.json(), rRes.json(), shopRes.json(), siteRes.json()])) as [
          { data?: VehicleType[] }, { data?: Dock[] }, { data?: { name?: string | null } },
          { data?: { item_minutes_enabled?: boolean; minutes_per_item?: number } },
        ];
        setVehicleTypes(sv.data ?? []);
        setResources((r.data ?? []).filter((d) => d.resource_type === 'dock'));
        if (shop.data?.name) setSiteName(shop.data.name);
        if (site.data) setItemMinutes({ enabled: site.data.item_minutes_enabled ?? false, minutesPerItem: site.data.minutes_per_item ?? 10 });
      } catch {
        // Reference data only feeds dropdowns; the list still renders without it.
      }
    })();
  }, []);

  const resourceLabel = t('dock', 'ท่า');
  const activeResources = resources.filter((r) => r.active !== false);
  const scopedResources = branchId ? activeResources.filter((r) => !r.branch_id || r.branch_id === branchId) : activeResources;

  // ── Mutations ──────────────────────────────────────────────────────────────

  async function submitCreate(draft: CreateDraft) {
    if (creating) return;
    // Untouched optional inputs hold '' — drop blanks so uuid / phone validation does not trip on them.
    const payload = Object.fromEntries(Object.entries(draft).filter(([, v]) => String(v ?? '').trim() !== ''));
    setCreating(true);
    try {
      const res = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = (await res.json().catch(() => ({}))) as { data?: { queue_number?: string; do_number?: string | null; notice?: string | null }; error?: string };
      if (!res.ok) { push(j.error ?? t('create_failed', 'สร้างคิวไม่สำเร็จ'), 'error'); return; }
      push(j.data?.notice ?? t('create_ok', 'สร้างคิวสำเร็จ'));
      setCreateResult({
        queueNo: String(j.data?.queue_number ?? '-'),
        doNumber: j.data?.do_number ?? null,
        date: draft.booking_date,
        time: draft.start_time,
        vehicle: vehicleTypes.find((v) => v.id === draft.service_id)?.service_name ?? '-',
      });
      reload();
    } finally {
      setCreating(false);
    }
  }

  /** Approval and cancellation need more input, so they open a dialog instead of patching straight away. */
  function requestStatus(b: BookingRow, status: string) {
    if (status === 'confirmed' && b.status === 'pending') { setApproveTarget(b); return; }
    if (status === 'cancelled') { setCancelTarget(b); return; }
    if (status === 'completed' && b.status === 'serving') { setCompleteTarget(b); return; }
    void updateStatus(b, status);
  }

  async function submitDuration(b: BookingRow, serviceMinutes: number) {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/bookings/${b.id}/duration`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ service_minutes: serviceMinutes }) });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { push(j.error ?? 'ปรับเวลาไม่สำเร็จ', 'error'); return; }
      push(`ปรับเวลาที่ท่าของ ${b.queue_number} เป็น ${serviceMinutes} นาทีแล้ว`);
      setScheduleTarget(null);
      setEditTarget(null);
      reload();
    } finally {
      setSaving(false);
    }
  }

  /** One dialog, two APIs: a move (with or without new minutes) goes to reschedule, minutes alone to duration. */
  async function submitSchedule(b: BookingRow, draft: ScheduleDraft, changes: ScheduleChanges) {
    if (!changes.moved) { await submitDuration(b, draft.minutes); return; }
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/bookings/${b.id}/reschedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_date: draft.date,
          start_time: draft.start,
          resource_id: draft.dockId || null,
          ...(changes.minutesChanged ? { service_minutes: draft.minutes } : {}),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; data?: { queue_number?: string } };
      if (!res.ok) { push(j.error ?? t('move_failed', 'เลื่อนคิวไม่สำเร็จ'), 'error'); return; }
      const renumbered = j.data?.queue_number && j.data.queue_number !== b.queue_number;
      const minutesNote = changes.minutesChanged ? ` · เวลาที่ท่า ${draft.minutes} นาที` : '';
      push(renumbered ? `เลื่อนคิวแล้ว — เลขคิวใหม่ ${j.data?.queue_number}${minutesNote} (แจ้งลูกค้าด้วย)` : `เลื่อนคิวแล้ว${minutesNote} — อย่าลืมแจ้งลูกค้า`);
      setScheduleTarget(null);
      setEditTarget(null);
      reload();
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(b: BookingRow, status: string, extra: { cancel_reason?: string; service_minutes?: number; signatures?: BookingSignatures } = {}) {
    if (saving) return;
    setSaving(true);
    try {
      const r = await patchBooking({ id: b.id, status, ...extra });
      if (!r.ok) { push(r.error ?? t('status_failed', 'เปลี่ยนสถานะไม่สำเร็จ'), 'error'); reload(); return; }
      if (status === 'confirmed' && r.doNumber) push(`ยืนยันคิวแล้ว · ${r.doNumber}`);
      else if (status === 'cancelled') push(t('cancel_ok', 'ยกเลิกคิวแล้ว'));
      else if (status === 'called') push(`เรียก ${b.queue_number} เข้า${b.resource_name ?? 'ท่า'}แล้ว`);
      else if (status === 'completed') push(extra.signatures && Object.keys(extra.signatures).length ? `ปิดงาน ${b.queue_number} พร้อมลายเซ็นแล้ว` : `ปิดงาน ${b.queue_number} แล้ว`);
      else push(t('status_ok', 'อัปเดตสถานะแล้ว'));
      if (r.autoCalled.length > 0) push(`ระบบเรียกคิวถัดไปอัตโนมัติ: ${r.autoCalled.join(', ')}`);
      setEditTarget(null);
      setApproveTarget(null);
      setCancelTarget(null);
      setCompleteTarget(null);
      reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={2}>
      <PageHeader
        title={t('title_dock', 'คิวรับ-ส่งสินค้า')}
        description={t('subtitle_dock', 'คิวรับสินค้าของลูกค้าและคิวส่งสินค้าของ Supplier — ยืนยัน ออก DO เช็คอิน และเลื่อนคิว')}
        action={
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => { setCreateResult(null); setCreateOpen(true); }}
            sx={{ width: { xs: '100%', sm: 'auto' }, minHeight: { xs: 44, sm: 'auto' } }} // phones: full-width thumb target
          >
            {t('create_queue', 'สร้างคิว')}
          </Button>
        }
      />

      <BookingsFilterBar
        value={filter}
        onChange={setFilter}
        onRefresh={reload}
        resources={scopedResources}
        resourceLabel={resourceLabel}
        total={total}
        loading={loading}
      />

      {error ? (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={reload}>{t('retry', 'ลองใหม่')}</Button>}>
          {error}
        </Alert>
      ) : null}

      <BookingsTable
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        busy={saving}
        isAdmin={isAdmin}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onStatus={requestStatus}
        onEdit={setEditTarget}
        onCreate={() => { setCreateResult(null); setCreateOpen(true); }}
      />

      <BookingCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        branches={branches}
        defaultBranchId={branchId}
        vehicleTypes={vehicleTypes}
        docks={activeResources}
        creating={creating}
        result={createResult}
        onSubmit={(d) => void submitCreate(d)}
        onReset={() => setCreateResult(null)}
      />

      <BookingEditDrawer
        booking={editTarget}
        saving={saving}
        siteName={siteName}
        onClose={() => setEditTarget(null)}
        onStatus={requestStatus}
        onSchedule={setScheduleTarget}
        onPayment={setPaymentTarget}
        onChanged={() => { setEditTarget(null); reload(); }}
      />

      <ApproveDialog booking={approveTarget} saving={saving} onClose={() => setApproveTarget(null)} onSubmit={(b, m) => void updateStatus(b, 'confirmed', { service_minutes: m })} itemMinutes={itemMinutes} />
      <CancelDialog booking={cancelTarget} saving={saving} onClose={() => setCancelTarget(null)} onSubmit={(b, reason) => void updateStatus(b, 'cancelled', { cancel_reason: reason })} />
      <CompleteDialog booking={completeTarget} saving={saving} onClose={() => setCompleteTarget(null)} onSubmit={(b, signatures) => void updateStatus(b, 'completed', Object.keys(signatures).length ? { signatures } : {})} />
      <PaymentDialog
        target={paymentTarget}
        onClose={() => setPaymentTarget(null)}
        onSaved={(r) => {
          push(r.unlocked.length > 0 ? `บันทึกการชำระเงินแล้ว — คิว ${r.unlocked.join(', ')} อนุมัติได้แล้ว` : 'บันทึกการชำระเงินแล้ว');
          setPaymentTarget(null);
          setEditTarget(null);
          reload();
        }}
      />

      <BookingScheduleDialog
        booking={scheduleTarget}
        saving={saving}
        itemMinutes={itemMinutes}
        onClose={() => setScheduleTarget(null)}
        onSubmit={(b, d, changes) => void submitSchedule(b, d, changes)}
      />
    </Stack>
  );
}
