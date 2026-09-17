'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Stack } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { PageHeader } from '@/components/shared/page-header';
import { useToast } from '@/components/ui/toast';
import { readPaywallDetail, useUpgrade } from '@/components/subscription/upgrade-provider';
import { useBranchScope } from '@/components/layout/branch-scope-provider';
import { track } from '@/lib/analytics/track';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { getTodayISOInBangkok } from '@/lib/utils/date-format';
import { resourceTypeLabel } from '@/lib/booking/resource-types';
import { BookingsFilterBar, dateForRange, type BookingsFilter } from '@/components/bookings/bookings-filter-bar';
import { BookingsTable } from '@/components/bookings/bookings-table';
import { BookingMoveDialog, type MoveDraft } from '@/components/bookings/booking-move-dialog';
import { BookingCreateDrawer, type CreateDraft, type CreateResult } from '@/components/bookings/booking-create-drawer';
import { BookingEditDrawer } from '@/components/bookings/booking-edit-drawer';
import { hhmm, type BookingRow, type Branch, type LineUser, type Resource, type Service } from '@/components/bookings/booking-types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Initial filter: `?date=YYYY-MM-DD` deep-links from the dashboard into one day. */
function initialFilter(): BookingsFilter {
  const today = getTodayISOInBangkok();
  const base: BookingsFilter = { range: 'today', date: today, status: '', resource: '', search: '' };
  if (typeof window === 'undefined') return base;
  const d = new URLSearchParams(window.location.search).get('date') ?? '';
  if (!ISO_DATE.test(d)) return base;
  if (d === today) return base;
  return { ...base, range: 'custom', date: d };
}

type PatchResult = { ok: boolean; error?: string; lineNotified: boolean };

async function patchBooking(body: Record<string, unknown>): Promise<PatchResult> {
  const res = await fetch('/api/bookings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string; data?: { line_notified?: boolean } };
  return { ok: res.ok, error: j.error, lineNotified: Boolean(j.data?.line_notified) };
}

/**
 * Bookings list page: filter strip, table with inline actions, create drawer,
 * detail drawer and the move dialog (date / time / resource in one step).
 */
export function BookingsCrud() {
  const { t } = useTranslation('bookings');
  const { push } = useToast();
  const { openPaywall } = useUpgrade();
  // Topbar branch selection narrows the list; the API enforces the caller's own scope.
  const { branchId, withBranch } = useBranchScope();

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

  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [lineUsers, setLineUsers] = useState<LineUser[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);

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
    const params = withBranch(new URLSearchParams({ page: String(page), page_size: String(pageSize) }));
    if (queryDate) params.set('date', queryDate);
    if (filter.status) params.set('status', filter.status);
    if (filter.resource) params.set('resource_id', filter.resource);
    if (debouncedSearch) params.set('q', debouncedSearch);
    return params.toString();
  }, [withBranch, page, pageSize, queryDate, filter.status, filter.resource, debouncedSearch]);

  // Any filter change goes back to page 1.
  useEffect(() => { setPage(1); }, [queryDate, filter.status, filter.resource, debouncedSearch, branchId, pageSize]);

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
        const [brRes, sRes, uRes, rRes] = await Promise.all([
          fetch('/api/branches', { cache: 'no-store' }),
          fetch('/api/services', { cache: 'no-store' }),
          fetch('/api/chat-inbox?page_size=100', { cache: 'no-store' }),
          fetch('/api/resources?page_size=500', { cache: 'no-store' }),
        ]);
        const [br, s, u, r] = (await Promise.all([brRes.json(), sRes.json(), uRes.json(), rRes.json()])) as [
          { data?: Branch[] }, { data?: Service[] }, { data?: { users?: LineUser[] } }, { data?: Resource[] },
        ];
        setBranches(br.data ?? []);
        setServices(s.data ?? []);
        setLineUsers(u.data?.users ?? []);
        setResources(r.data ?? []);
      } catch {
        // Reference data only feeds dropdowns; the list still renders without it.
      }
    })();
  }, []);

  // A shop usually runs one kind of resource, so name the column after it
  // ("เทรนเนอร์", "โต๊ะ"). Mixed shops fall back to a neutral word.
  const resourceTypes = Array.from(new Set(resources.map((r) => r.resource_type)));
  const resourceLabel = resourceTypes.length === 1 ? resourceTypeLabel(resourceTypes[0]) : t('resource_generic', 'ผู้ให้บริการ');
  const activeResources = resources.filter((r) => r.active !== false);

  // ── Mutations ──────────────────────────────────────────────────────────────

  async function submitCreate(draft: CreateDraft, lineUserId: string) {
    if (creating) return;
    // Untouched optional inputs hold '' — the API validates party_size/resource_id as
    // number/uuid, so sending '' fails the whole payload. Drop blanks instead.
    const payload: Record<string, unknown> = Object.fromEntries(
      Object.entries(draft).filter(([, v]) => String(v ?? '').trim() !== ''),
    );
    const selected = lineUsers.find((x) => x.id === lineUserId);
    if (selected) {
      payload.line_user_pk = selected.id;
      payload.line_user_external_id = selected.line_user_id;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = (await res.json().catch(() => ({}))) as { data?: { queue_number?: string; line_push_sent?: boolean; line_push_error?: string }; error?: string };

      const paywall = readPaywallDetail(res, j);
      if (paywall) { openPaywall(paywall); return; }
      if (!res.ok) { push(j.error ?? t('create_failed', 'เพิ่มคิวไม่สำเร็จ'), 'error'); return; }

      track('booking_created', { channel: 'portal', line_push_sent: Boolean(j.data?.line_push_sent) });
      if (j.data?.line_push_sent) push(t('create_ok_line', 'เพิ่มคิวสำเร็จ และส่งข้อความ LINE แล้ว'));
      else if (selected) push(`${t('create_ok_line_failed', 'เพิ่มคิวสำเร็จ แต่ส่ง LINE ไม่สำเร็จ')}: ${j.data?.line_push_error ?? '-'}`, 'error');
      else push(t('create_ok', 'เพิ่มคิวสำเร็จ'));

      setCreateResult({
        queueNo: String(j.data?.queue_number ?? '-'),
        branch: branches.find((b) => b.id === draft.branch_id)?.branch_name ?? '-',
        service: services.find((s) => s.id === draft.service_id)?.service_name ?? '-',
        date: draft.booking_date,
        time: draft.start_time,
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
      if (!r.ok) { push(r.error ?? t('status_failed', 'เปลี่ยนสถานะไม่สำเร็จ'), 'error'); return; }
      if (status === 'cancelled') {
        push(r.lineNotified ? t('cancel_ok_line', 'ยกเลิกคิวแล้ว และแจ้งลูกค้าทาง LINE') : b.line_user_id ? t('cancel_ok_line_failed', 'ยกเลิกคิวแล้ว แต่ส่ง LINE ไม่สำเร็จ') : t('cancel_ok', 'ยกเลิกคิวแล้ว'));
      } else if (status === 'called') {
        // Staff need to know whether the customer's phone actually buzzed; a
        // walk-in without LINE means they have to shout the number themselves.
        if (r.lineNotified) push(t('call_ok_line', 'เรียกคิวแล้ว และแจ้งลูกค้าทาง LINE'));
        else if (b.line_user_id) push(t('call_ok_line_failed', 'เรียกคิวแล้ว แต่ส่ง LINE ไม่สำเร็จ — กรุณาเรียกลูกค้าเอง'), 'error');
        else push(t('call_ok_no_line', 'เรียกคิวแล้ว (คิวไม่ได้ผูก LINE กรุณาเรียกลูกค้าเอง)'));
      } else if (b.status === 'pending_approval' && status === 'confirmed') {
        push(r.lineNotified ? t('approve_ok_line', 'อนุมัติคิวแล้ว และแจ้งลูกค้าทาง LINE') : b.line_user_id ? t('approve_ok_line_failed', 'อนุมัติคิวแล้ว แต่ส่ง LINE ไม่สำเร็จ') : t('approve_ok', 'อนุมัติคิวแล้ว'));
      } else {
        push(t('status_ok', 'อัปเดตสถานะแล้ว'));
      }
      setEditTarget(null);
      reload();
    } finally {
      setSaving(false);
    }
  }

  /**
   * Move = reschedule + reassign in one PATCH, so the API validates the target
   * once and the customer receives a single LINE notice.
   */
  async function submitMove(draft: MoveDraft) {
    const b = moveTarget;
    if (!b || saving) return;
    setSaving(true);
    try {
      const slotChanged = draft.date !== b.booking_date || draft.time !== hhmm(b.start_time);
      const resourceChanged = draft.resourceId !== (b.resource_id ?? '');
      const body: Record<string, unknown> = { id: b.id };
      if (slotChanged) { body.booking_date = draft.date; body.start_time = draft.time; }
      if (resourceChanged) body.resource_id = draft.resourceId || null;

      const r = await patchBooking(body);
      if (!r.ok) { push(r.error ?? t('move_failed', 'ย้ายคิวไม่สำเร็จ'), 'error'); return; }

      if (r.lineNotified) push(t('move_ok_line', 'ย้ายคิวแล้ว และแจ้งลูกค้าทาง LINE'));
      else if (b.line_user_id && slotChanged) push(t('move_ok_line_failed', 'ย้ายคิวแล้ว แต่ส่ง LINE ไม่สำเร็จ — กรุณาแจ้งลูกค้าเอง'), 'error');
      else if (!b.line_user_id) push(t('move_ok_no_line', 'ย้ายคิวแล้ว (คิวไม่ได้ผูก LINE กรุณาแจ้งลูกค้าเอง)'));
      else push(t('move_ok', 'ย้ายคิวแล้ว'));
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
        title={t('title', 'จัดการคิว')}
        description={t('subtitle', 'รายการจองทั้งหมด เปลี่ยนสถานะ โยกย้ายคิว และเพิ่มคิวหน้าร้าน')}
        action={
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => { setCreateResult(null); setCreateOpen(true); }}
            sx={{ width: { xs: '100%', sm: 'auto' }, minHeight: { xs: 44, sm: 'auto' } }} // phones: full-width thumb target
          >
            {t('add_queue', 'เพิ่มคิวใหม่')}
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
        resourceLabel={resourceLabel}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onStatus={(b, s) => void updateStatus(b, s)}
        onMove={setMoveTarget}
        onEdit={setEditTarget}
        onCreate={() => { setCreateResult(null); setCreateOpen(true); }}
      />

      <BookingCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        branches={branches}
        services={services}
        lineUsers={lineUsers}
        resources={activeResources}
        resourceLabel={resourceLabel}
        creating={creating}
        result={createResult}
        onSubmit={(d, u) => void submitCreate(d, u)}
        onReset={() => setCreateResult(null)}
      />

      <BookingEditDrawer
        booking={editTarget}
        resourceLabel={resourceLabel}
        saving={saving}
        onClose={() => setEditTarget(null)}
        onStatus={(b, s) => void updateStatus(b, s)}
        onMove={setMoveTarget}
      />

      <BookingMoveDialog
        booking={moveTarget}
        resources={resources}
        resourceLabel={resourceLabel}
        saving={saving}
        onClose={() => setMoveTarget(null)}
        onSubmit={(d) => void submitMove(d)}
      />
    </Stack>
  );
}
