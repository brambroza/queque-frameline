'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Stack } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { PageHeader } from '@/components/shared/page-header';
import { useToast } from '@/components/ui/toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { getTodayISOInBangkok } from '@/lib/utils/date-format';
import { BookingsFilterBar, dateForRange, type BookingsFilter } from '@/components/bookings/bookings-filter-bar';
import { BookingsTable } from '@/components/bookings/bookings-table';
import { BookingMoveDialog, type MoveDraft } from '@/components/bookings/booking-move-dialog';
import { BookingCreateDrawer, type CreateDraft, type CreateResult } from '@/components/bookings/booking-create-drawer';
import { BookingEditDrawer } from '@/components/bookings/booking-edit-drawer';
import { type BookingRow, type Dock, type VehicleType } from '@/components/bookings/booking-types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Initial filter: `?date=YYYY-MM-DD` deep-links from the dashboard into one day. */
function initialFilter(): BookingsFilter {
  const today = getTodayISOInBangkok();
  const base: BookingsFilter = { range: 'today', date: today, status: '', direction: '', resource: '', search: '' };
  if (typeof window === 'undefined') return base;
  const d = new URLSearchParams(window.location.search).get('date') ?? '';
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

  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [resources, setResources] = useState<Dock[]>([]);
  const [siteName, setSiteName] = useState('Fameline');

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<CreateResult | null>(null);
  const [editTarget, setEditTarget] = useState<BookingRow | null>(null);
  const [moveTarget, setMoveTarget] = useState<BookingRow | null>(null);
  const [saving, setSaving] = useState(false);

  // Search is typed continuously; wait for a pause before hitting the API.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(filter.search.trim()), 300);
    return () => clearTimeout(id);
  }, [filter.search]);

  const queryDate = filter.range === 'custom' ? filter.date : dateForRange(filter.range, filter.date);
  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (queryDate) params.set('date', queryDate);
    if (filter.status) params.set('status', filter.status);
    if (filter.direction) params.set('direction', filter.direction);
    if (filter.resource) params.set('resource_id', filter.resource);
    if (debouncedSearch) params.set('q', debouncedSearch);
    return params.toString();
  }, [page, pageSize, queryDate, filter.status, filter.direction, filter.resource, debouncedSearch]);

  // Any filter change goes back to page 1.
  useEffect(() => { setPage(1); }, [queryDate, filter.status, filter.direction, filter.resource, debouncedSearch, pageSize]);

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
        const [sRes, rRes, shopRes] = await Promise.all([
          fetch('/api/services?page_size=200', { cache: 'no-store' }),
          fetch('/api/resources?page_size=500', { cache: 'no-store' }),
          fetch('/api/shop-profile', { cache: 'no-store' }),
        ]);
        const [sv, r, shop] = (await Promise.all([sRes.json(), rRes.json(), shopRes.json()])) as [
          { data?: VehicleType[] }, { data?: Dock[] }, { data?: { name?: string | null } },
        ];
        setVehicleTypes(sv.data ?? []);
        setResources((r.data ?? []).filter((d) => d.resource_type === 'dock'));
        if (shop.data?.name) setSiteName(shop.data.name);
      } catch {
        // Reference data only feeds dropdowns; the list still renders without it.
      }
    })();
  }, []);

  const resourceLabel = t('dock', 'ท่า');
  const activeResources = resources.filter((r) => r.active !== false);

  // ── Mutations ──────────────────────────────────────────────────────────────

  async function submitCreate(draft: CreateDraft) {
    if (creating) return;
    // Untouched optional inputs hold '' — drop blanks so uuid / phone validation does not trip on them.
    const payload = Object.fromEntries(Object.entries(draft).filter(([, v]) => String(v ?? '').trim() !== ''));
    setCreating(true);
    try {
      const res = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = (await res.json().catch(() => ({}))) as { data?: { queue_number?: string; do_number?: string | null }; error?: string };
      if (!res.ok) { push(j.error ?? t('create_failed', 'สร้างคิวไม่สำเร็จ'), 'error'); return; }
      push(t('create_ok', 'สร้างคิวสำเร็จ'));
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

  async function updateStatus(b: BookingRow, status: string) {
    if (saving) return;
    setSaving(true);
    try {
      const r = await patchBooking({ id: b.id, status });
      if (!r.ok) { push(r.error ?? t('status_failed', 'เปลี่ยนสถานะไม่สำเร็จ'), 'error'); reload(); return; }
      if (status === 'confirmed' && r.doNumber) push(`ยืนยันคิวแล้ว · ${r.doNumber}`);
      else if (status === 'cancelled') push(t('cancel_ok', 'ยกเลิกคิวแล้ว'));
      else if (status === 'called') push(`เรียก ${b.queue_number} เข้า${b.resource_name ?? 'ท่า'}แล้ว`);
      else push(t('status_ok', 'อัปเดตสถานะแล้ว'));
      if (r.autoCalled.length > 0) push(`ระบบเรียกคิวถัดไปอัตโนมัติ: ${r.autoCalled.join(', ')}`);
      setEditTarget(null);
      reload();
    } finally {
      setSaving(false);
    }
  }

  async function submitMove(draft: MoveDraft) {
    const b = moveTarget;
    if (!b || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/bookings/${b.id}/reschedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_date: draft.date, start_time: draft.time, resource_id: draft.resourceId || null }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; data?: { queue_number?: string } };
      if (!res.ok) { push(j.error ?? t('move_failed', 'เลื่อนคิวไม่สำเร็จ'), 'error'); return; }
      const renumbered = j.data?.queue_number && j.data.queue_number !== b.queue_number;
      push(renumbered ? `เลื่อนคิวแล้ว — เลขคิวใหม่ ${j.data?.queue_number} (แจ้งลูกค้าด้วย)` : 'เลื่อนคิวแล้ว — อย่าลืมแจ้งลูกค้า');
      setMoveTarget(null);
      setEditTarget(null);
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
        resources={resources}
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
        onStatus={(b, s) => void updateStatus(b, s)}
        onEdit={setEditTarget}
        onCreate={() => { setCreateResult(null); setCreateOpen(true); }}
      />

      <BookingCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        vehicleTypes={vehicleTypes}
        docks={activeResources}
        creating={creating}
        result={createResult}
        onSubmit={(d) => void submitCreate(d)}
        onReset={() => setCreateResult(null)}
      />

      <BookingEditDrawer
        booking={editTarget}
        isAdmin={isAdmin}
        saving={saving}
        siteName={siteName}
        onClose={() => setEditTarget(null)}
        onStatus={(b, s) => void updateStatus(b, s)}
        onMove={setMoveTarget}
        onChanged={() => { setEditTarget(null); reload(); }}
      />

      <BookingMoveDialog
        booking={moveTarget}
        resources={resources}
        saving={saving}
        onClose={() => setMoveTarget(null)}
        onSubmit={(d) => void submitMove(d)}
      />
    </Stack>
  );
}
