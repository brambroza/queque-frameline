'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import LocalCafeRoundedIcon from '@mui/icons-material/LocalCafeRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import { Chip } from '@mui/material';
import { MobileCardList } from '@/components/ui/responsive-table';
import { MobileRecordCard } from '@/components/ui/mobile-record-card';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { TablePaginationControls } from '@/components/ui/table-pagination-controls';
import { ActionIconGroup } from '@/components/ui/action-icon-group';

type Branch = { id: string; branch_name: string };
type WorkingHour = {
  id: string;
  branch_id: string;
  weekday: number;
  open_time: string;
  close_time: string;
  break_start?: string | null;
  break_end?: string | null;
  slot_interval_minutes: number;
  capacity_per_slot: number;
  direction?: 'inbound' | 'outbound' | null;
  active: boolean;
  branches?: { branch_name?: string } | null;
};

type Draft = {
  id?: string;
  branch_id: string;
  weekday: string;
  open_time: string;
  close_time: string;
  break_start: string;
  break_end: string;
  slot_interval_minutes: string;
  capacity_per_slot: string;
  /** '' = both directions. */
  direction: '' | 'inbound' | 'outbound';
  active: boolean;
};

const WEEKDAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

const EMPTY_DRAFT: Draft = {
  branch_id: '',
  weekday: '1',
  open_time: '09:00',
  close_time: '18:00',
  break_start: '',
  break_end: '',
  slot_interval_minutes: '30',
  capacity_per_slot: '1',
  direction: '',
  active: true,
};

export function WorkingHoursCrud() {
  const { push } = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<WorkingHour[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  // Creating one weekday at a time meant seven drawer submits to open a shop
  // all week, which is where most owners stopped. Creation is multi-day.
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const pagedRows = useMemo(() => rows.slice((page - 1) * rowsPerPage, page * rowsPerPage), [rows, page, rowsPerPage]);

  async function load() {
    const [hrsRes, brRes] = await Promise.all([fetch('/api/working-hours', { cache: 'no-store' }), fetch('/api/branches', { cache: 'no-store' })]);
    const [hrs, br] = await Promise.all([hrsRes.json(), brRes.json()]);
    if (!hrsRes.ok) return push(hrs.error ?? 'โหลดเวลาทำการไม่สำเร็จ', 'error');
    if (!brRes.ok) return push(br.error ?? 'โหลดสาขาไม่สำเร็จ', 'error');
    setRows((hrs.data ?? []) as WorkingHour[]);
    setBranches((br.data ?? []) as Branch[]);
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setDraft({ ...EMPTY_DRAFT, branch_id: branches[0]?.id ?? '' });
    setSelectedWeekdays([1, 2, 3, 4, 5]);
    setDrawerOpen(true);
  }

  function toggleWeekday(idx: number) {
    setSelectedWeekdays((prev) => (prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort()));
  }

  function openEdit(row: WorkingHour) {
    setDraft({
      id: row.id,
      branch_id: row.branch_id,
      weekday: String(row.weekday),
      open_time: String(row.open_time).slice(0, 5),
      close_time: String(row.close_time).slice(0, 5),
      break_start: row.break_start ? String(row.break_start).slice(0, 5) : '',
      break_end: row.break_end ? String(row.break_end).slice(0, 5) : '',
      slot_interval_minutes: String(row.slot_interval_minutes),
      capacity_per_slot: String(row.capacity_per_slot),
      direction: row.direction ?? '',
      active: Boolean(row.active),
    });
    setDrawerOpen(true);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const basePayload = {
      branch_id: draft.branch_id,
      open_time: draft.open_time,
      close_time: draft.close_time,
      break_start: draft.break_start || null,
      break_end: draft.break_end || null,
      slot_interval_minutes: Number(draft.slot_interval_minutes),
      capacity_per_slot: Number(draft.capacity_per_slot),
      direction: draft.direction || null,
      active: draft.active,
    };

    if (draft.id) {
      setSaving(true);
      const res = await fetch('/api/working-hours', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draft.id, weekday: Number(draft.weekday), ...basePayload }),
      });
      const json = await res.json();
      setSaving(false);
      if (!res.ok) return push(json.error ?? 'บันทึกไม่สำเร็จ', 'error');
      push('แก้ไขเวลาทำการแล้ว');
    } else {
      if (selectedWeekdays.length === 0) return push('กรุณาเลือกอย่างน้อย 1 วัน', 'error');

      setSaving(true);
      const results = await Promise.all(
        selectedWeekdays.map(async (weekday) => {
          const res = await fetch('/api/working-hours', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ weekday, ...basePayload }),
          });
          const json = await res.json();
          return { weekday, ok: res.ok, error: json.error as string | undefined };
        })
      );
      setSaving(false);

      const failed = results.filter((r) => !r.ok);
      if (failed.length === results.length) {
        return push(failed[0]?.error ?? 'บันทึกไม่สำเร็จ', 'error');
      }
      if (failed.length > 0) {
        push(`บันทึกได้ ${results.length - failed.length} วัน • ไม่สำเร็จ ${failed.length} วัน`, 'error');
      } else {
        push(`เพิ่มเวลาทำการ ${results.length} วันแล้ว`);
      }
    }

    setDrawerOpen(false);
    setDraft(EMPTY_DRAFT);
    void load();
  }

  async function onDelete(row: WorkingHour) {
    const ok = await confirm({
      tone: 'error',
      title: 'ลบเวลาทำการนี้?',
      description: 'ลูกค้าจะจองคิวในช่วงเวลานี้ไม่ได้อีก คิวที่จองไว้แล้วยังอยู่',
      context: {
        primary: `${WEEKDAYS[row.weekday] ?? row.weekday} · ${row.open_time.slice(0, 5)}–${row.close_time.slice(0, 5)}`,
        secondary: row.branches?.branch_name ?? undefined,
        avatar: (WEEKDAYS[row.weekday] ?? '').slice(0, 2),
      },
      confirmLabel: 'ลบเวลาทำการ',
    });
    if (!ok) return;
    const res = await fetch(`/api/working-hours?id=${row.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'ลบไม่สำเร็จ', 'error');
    push('ลบเวลาทำการแล้ว');
    void load();
  }

  return (
    <div className="space-y-4">
      {/* Phones: title row then a full-width 44px button. sm+: title left, button right (unchanged). */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">จัดการวันทำงาน</h3>
          <p className="text-xs text-slate-500 sm:hidden">{rows.length} รายการ</p>
        </div>
        <button className="btn-primary min-h-[44px] sm:min-h-0" onClick={openCreate}>เพิ่มวันทำงาน</button>
      </div>

      <div className="card p-4">
        {rows.length === 0 ? (
          <EmptyState
            title="ยังไม่ได้ตั้งเวลาทำการ"
            description="ถ้าไม่มีเวลาทำการ ระบบจะถือว่าร้านปิดทุกวัน และลูกค้าจะจองคิวไม่ได้เลย"
            actionLabel="ตั้งเวลาทำการ"
            onAction={openCreate}
            icon="🕘"
          />
        ) : (
          <>
          {/* Phones: one card per working day, same look as /portal/services. */}
          <MobileCardList
            rows={pagedRows}
            rowKey={(r) => r.id}
            columns={[]}
            renderCard={(r) => (
              <MobileRecordCard
                title={WEEKDAYS[r.weekday] ?? String(r.weekday)}
                subtitle={r.branches?.branch_name ?? undefined}
                status={{ active: r.active, inactiveLabel: 'ปิด' }}
                tags={<Chip size="small" variant="outlined" color="primary" icon={<GroupsRoundedIcon />} label={r.direction === 'outbound' ? 'รับสินค้า' : r.direction === 'inbound' ? 'ส่งสินค้า' : 'รับ + ส่ง'} />}
                stats={[
                  { icon: <AccessTimeRoundedIcon />, value: `${String(r.open_time).slice(0, 5)}–${String(r.close_time).slice(0, 5)}`, label: 'เปิด-ปิด' },
                  { icon: <LocalCafeRoundedIcon />, value: r.break_start ? `${String(r.break_start).slice(0, 5)}–${String(r.break_end ?? '').slice(0, 5)}` : '-', label: 'พัก' },
                  { icon: <TimerRoundedIcon />, value: `${r.slot_interval_minutes} นาที`, label: 'ต่อ slot' },
                ]}
                onEdit={() => openEdit(r)}
                onDelete={() => void onDelete(r)}
              />
            )}
            sx={{ display: { xs: 'flex', sm: 'none' }, mx: -2, mt: -2, p: 1.5, bgcolor: 'action.hover' }}
          />
          <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr>
                <th className="px-2 py-2 text-left">สาขา</th>
                <th className="px-2 py-2 text-left">วัน</th>
                <th className="px-2 py-2 text-left">เวลาเปิด-ปิด</th>
                <th className="px-2 py-2 text-left">พัก</th>
                <th className="px-2 py-2 text-left">Slot</th>
                <th className="px-2 py-2 text-left">ใช้กับ</th>
                <th className="px-2 py-2 text-left">สถานะ</th>
                <th className="px-2 py-2 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-2 py-2">{r.branches?.branch_name ?? '-'}</td>
                  <td className="px-2 py-2">{WEEKDAYS[r.weekday] ?? r.weekday}</td>
                  <td className="px-2 py-2">{String(r.open_time).slice(0, 5)} - {String(r.close_time).slice(0, 5)}</td>
                  <td className="px-2 py-2">{r.break_start ? `${String(r.break_start).slice(0, 5)} - ${String(r.break_end ?? '').slice(0, 5)}` : '-'}</td>
                  <td className="px-2 py-2">{r.slot_interval_minutes} นาที</td>
                  <td className="px-2 py-2">{r.direction === 'outbound' ? 'รับสินค้า' : r.direction === 'inbound' ? 'ส่งสินค้า' : 'รับ + ส่ง'}</td>
                  <td className="px-2 py-2">{r.active ? 'เปิดใช้งาน' : 'ปิด'}</td>
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
              <h4 className="text-lg font-semibold">{draft.id ? 'แก้ไขวันทำงาน' : 'เพิ่มวันทำงาน'}</h4>
              <button className="btn-outline" onClick={() => setDrawerOpen(false)}>ปิด</button>
            </div>

            <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">สาขา</label>
                <select className="input" value={draft.branch_id} onChange={(e) => setDraft((p) => ({ ...p, branch_id: e.target.value }))} required>
                  <option value="">เลือกสาขา</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
                </select>
              </div>

              {draft.id ? (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">วันในสัปดาห์</label>
                  <select className="input" value={draft.weekday} onChange={(e) => setDraft((p) => ({ ...p, weekday: e.target.value }))} required>
                    {WEEKDAYS.map((name, idx) => <option key={name} value={idx}>{name}</option>)}
                  </select>
                </div>
              ) : (
                <div className="space-y-2 sm:col-span-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs font-medium text-slate-600">วันในสัปดาห์</label>
                    <button type="button" className="text-xs font-medium text-emerald-700 underline" onClick={() => setSelectedWeekdays([0, 1, 2, 3, 4, 5, 6])}>
                      ทุกวัน
                    </button>
                    <button type="button" className="text-xs font-medium text-emerald-700 underline" onClick={() => setSelectedWeekdays([1, 2, 3, 4, 5])}>
                      จันทร์-ศุกร์
                    </button>
                    <button type="button" className="text-xs font-medium text-emerald-700 underline" onClick={() => setSelectedWeekdays([0, 6])}>
                      เสาร์-อาทิตย์
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((name, idx) => {
                      const active = selectedWeekdays.includes(idx);
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => toggleWeekday(idx)}
                          className={`rounded-full border px-3 py-1 text-xs transition ${
                            active ? 'border-emerald-500 bg-emerald-50 font-semibold text-emerald-700' : 'border-slate-200 text-slate-600'
                          }`}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-500">
                    เลือกได้หลายวัน ระบบจะสร้างเวลาทำการให้ทุกวันที่เลือกด้วยค่าเดียวกัน
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">เวลาเปิด</label>
                <input className="input" type="time" value={draft.open_time} onChange={(e) => setDraft((p) => ({ ...p, open_time: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">เวลาปิด</label>
                <input className="input" type="time" value={draft.close_time} onChange={(e) => setDraft((p) => ({ ...p, close_time: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">พักเริ่ม</label>
                <input className="input" type="time" value={draft.break_start} onChange={(e) => setDraft((p) => ({ ...p, break_start: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">พักสิ้นสุด</label>
                <input className="input" type="time" value={draft.break_end} onChange={(e) => setDraft((p) => ({ ...p, break_end: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">ช่วงเวลาต่อสล็อต (นาที)</label>
                <input className="input" type="number" min={5} max={180} value={draft.slot_interval_minutes} onChange={(e) => setDraft((p) => ({ ...p, slot_interval_minutes: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">ใช้กับคิวประเภท</label>
                <select className="input" value={draft.direction} onChange={(e) => setDraft((p) => ({ ...p, direction: e.target.value as Draft['direction'] }))}>
                  <option value="">รับ + ส่ง</option>
                  <option value="outbound">รับสินค้าเท่านั้น</option>
                  <option value="inbound">ส่งสินค้าเท่านั้น</option>
                </select>
                <p className="text-xs text-slate-500">แถวที่ระบุประเภทจะถูกใช้ก่อนแถว “รับ + ส่ง” ของวันเดียวกัน · จำนวนรถต่อช่วงเวลา = จำนวนท่าที่ว่าง</p>
              </div>

              <label className="text-sm flex items-center gap-2 sm:col-span-2">
                <input type="checkbox" checked={draft.active} onChange={(e) => setDraft((p) => ({ ...p, active: e.target.checked }))} />
                เปิดใช้งาน
              </label>

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
