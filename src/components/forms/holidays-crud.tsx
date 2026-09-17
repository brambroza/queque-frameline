'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import { Chip } from '@mui/material';
import { MobileCardList } from '@/components/ui/responsive-table';
import { MobileRecordCard } from '@/components/ui/mobile-record-card';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { TablePaginationControls } from '@/components/ui/table-pagination-controls';
import { ActionIconGroup } from '@/components/ui/action-icon-group';
import { formatDateDMY } from '@/lib/utils/date-format';

type Branch = { id: string; branch_name: string };
type Holiday = {
  id: string;
  branch_id?: string | null;
  holiday_date: string;
  reason?: string | null;
  branches?: { branch_name?: string } | null;
};

type Draft = {
  id?: string;
  branch_id: string;
  holiday_date: string;
  reason: string;
};

const EMPTY_DRAFT: Draft = {
  branch_id: '',
  holiday_date: '',
  reason: '',
};

const WEEKDAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

/** Thai weekday name for a `YYYY-MM-DD` date, or null when the date is malformed. */
function weekdayLabel(isoDate: string): string | null {
  const d = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : `วัน${WEEKDAYS[d.getDay()]}`;
}

export function HolidaysCrud() {
  const { push } = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<Holiday[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const pagedRows = useMemo(() => rows.slice((page - 1) * rowsPerPage, page * rowsPerPage), [rows, page, rowsPerPage]);

  async function load() {
    const [holidayRes, brRes] = await Promise.all([fetch('/api/holidays', { cache: 'no-store' }), fetch('/api/branches', { cache: 'no-store' })]);
    const [holidayJson, brJson] = await Promise.all([holidayRes.json(), brRes.json()]);

    if (!holidayRes.ok) return push(holidayJson.error ?? 'โหลดวันหยุดไม่สำเร็จ', 'error');
    if (!brRes.ok) return push(brJson.error ?? 'โหลดสาขาไม่สำเร็จ', 'error');

    setRows((holidayJson.data ?? []) as Holiday[]);
    setBranches((brJson.data ?? []) as Branch[]);
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setDraft({ ...EMPTY_DRAFT });
    setDrawerOpen(true);
  }

  function openEdit(row: Holiday) {
    setDraft({
      id: row.id,
      branch_id: row.branch_id ?? '',
      holiday_date: row.holiday_date,
      reason: row.reason ?? '',
    });
    setDrawerOpen(true);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      branch_id: draft.branch_id || null,
      holiday_date: draft.holiday_date,
      reason: draft.reason || null,
    };

    const res = await fetch('/api/holidays', {
      method: draft.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft.id ? { id: draft.id, ...payload } : payload),
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) return push(json.error ?? 'บันทึกไม่สำเร็จ', 'error');

    push(draft.id ? 'แก้ไขวันหยุดแล้ว' : 'เพิ่มวันหยุดแล้ว');
    setDrawerOpen(false);
    setDraft(EMPTY_DRAFT);
    void load();
  }

  async function onDelete(row: Holiday) {
    const ok = await confirm({
      tone: 'error',
      title: 'ลบวันหยุดนี้?',
      description: 'ลูกค้าจะจองคิววันนี้ได้อีกครั้งทันทีตามเวลาทำการปกติ',
      context: {
        primary: formatDateDMY(row.holiday_date),
        secondary: [row.branches?.branch_name ?? 'ทุกสาขา', row.reason].filter(Boolean).join(' · '),
      },
      confirmLabel: 'ลบวันหยุด',
    });
    if (!ok) return;
    const res = await fetch(`/api/holidays?id=${row.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'ลบไม่สำเร็จ', 'error');
    push('ลบวันหยุดแล้ว');
    void load();
  }

  return (
    <div className="space-y-4">
      {/* Phones: title row then a full-width 44px button. sm+: title left, button right (unchanged). */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">จัดการวันหยุด</h3>
          <p className="text-xs text-slate-500 sm:hidden">{rows.length} รายการ</p>
        </div>
        <button className="btn-primary min-h-[44px] sm:min-h-0" onClick={openCreate}>เพิ่มวันหยุด</button>
      </div>

      <div className="card p-4">
        {rows.length === 0 ? (
          <EmptyState
            title="ยังไม่มีวันหยุด"
            description="เพิ่มวันหยุดเพื่อปิดรับคิวเฉพาะวัน โดยไม่ต้องแก้เวลาทำการ"
            actionLabel="เพิ่มวันหยุด"
            onAction={openCreate}
            icon="📅"
          />
        ) : (
          <>
          {/* Phones: one card per holiday, same look as /portal/services. */}
          <MobileCardList
            rows={pagedRows}
            rowKey={(r) => r.id}
            columns={[]}
            renderCard={(r) => {
              const weekday = weekdayLabel(r.holiday_date);
              return (
                <MobileRecordCard
                  title={formatDateDMY(r.holiday_date)}
                  subtitle={r.reason || undefined}
                  tags={
                    <>
                      {weekday ? <Chip size="small" variant="outlined" color="primary" icon={<EventRoundedIcon />} label={weekday} /> : null}
                      <Chip size="small" variant="outlined" icon={<StorefrontRoundedIcon />} label={r.branches?.branch_name ?? 'ทุกสาขา'} />
                    </>
                  }
                  onEdit={() => openEdit(r)}
                  onDelete={() => void onDelete(r)}
                />
              );
            }}
            sx={{ display: { xs: 'flex', sm: 'none' }, mx: -2, mt: -2, p: 1.5, bgcolor: 'action.hover' }}
          />
          <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr>
                <th className="px-2 py-2 text-left">วันที่</th>
                <th className="px-2 py-2 text-left">สาขา</th>
                <th className="px-2 py-2 text-left">เหตุผล</th>
                <th className="px-2 py-2 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-2 py-2">{formatDateDMY(r.holiday_date)}</td>
                  <td className="px-2 py-2">{r.branches?.branch_name ?? 'ทุกสาขา'}</td>
                  <td className="px-2 py-2">{r.reason || '-'}</td>
                  <td className="px-2 py-2 text-right">
                    <ActionIconGroup
                      actions={[
                        { key: 'edit', icon: <EditOutlinedIcon fontSize="small" />, labelKey: 'common.edit', fallbackLabel: 'Edit', onClick: () => openEdit(r) },
                        { key: 'delete', icon: <DeleteOutlineIcon fontSize="small" />, labelKey: 'common.delete', fallbackLabel: 'Delete', color: 'error', onClick: () => void onDelete(r) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          </>
        )}

        {rows.length > 0 ? (
          <TablePaginationControls
            page={page}
            rowsPerPage={rowsPerPage}
            total={rows.length}
            onPageChange={setPage}
            onRowsPerPageChange={(v) => { setRowsPerPage(v); setPage(1); }}
          />
        ) : null}
      </div>

      {drawerOpen ? (
        <>
          <button className="fixed inset-0 z-40 bg-slate-900/30" onClick={() => setDrawerOpen(false)} aria-label="Close drawer" />
          <aside className="fixed right-0 top-0 z-50 h-dvh w-full overflow-y-auto bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:w-[60%]">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <h4 className="text-lg font-semibold">{draft.id ? 'แก้ไขวันหยุด' : 'เพิ่มวันหยุด'}</h4>
              <button className="btn-outline" onClick={() => setDrawerOpen(false)}>ปิด</button>
            </div>

            <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
              <input className="input" type="date" value={draft.holiday_date} onChange={(e) => setDraft((p) => ({ ...p, holiday_date: e.target.value }))} required />
              <select className="input" value={draft.branch_id} onChange={(e) => setDraft((p) => ({ ...p, branch_id: e.target.value }))}>
                <option value="">ทุกสาขา</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
              </select>
              <input className="input sm:col-span-2" value={draft.reason} onChange={(e) => setDraft((p) => ({ ...p, reason: e.target.value }))} placeholder="เหตุผล (เช่น วันนักขัตฤกษ์)" />

              <div className="sm:col-span-2 flex gap-2 pt-2">
                <button className="btn-primary" disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
                <button type="button" className="btn-outline" onClick={() => setDrawerOpen(false)}>ยกเลิก</button>
              </div>
            </form>
          </aside>
        </>
      ) : null}

    </div>
  );
}
