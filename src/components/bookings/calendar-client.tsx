'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import TodayRoundedIcon from '@mui/icons-material/TodayRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import MeetingRoomRoundedIcon from '@mui/icons-material/MeetingRoomRounded';
import { useToast } from '@/components/ui/toast';
import { useBranchScope } from '@/components/layout/branch-scope-provider';
import { formatDateDMY } from '@/lib/utils/date-format';
import { customerLabel } from '@/lib/booking/customer-label';
import { RESOURCE_TYPES, isPersonResourceType, resourceTypeLabel, type ResourceType } from '@/lib/booking/resource-types';

type Row = {
  id: string;
  booking_date: string;
  start_time: string;
  end_time?: string | null;
  status: string;
  queue_number: string;
  resource_id?: string | null;
  resource_name?: string | null;
  branches: { branch_name?: string } | null;
  services: { service_name?: string } | null;
  customers: { full_name?: string | null; nickname?: string | null } | null;
};

type Resource = {
  id: string;
  resource_type: ResourceType;
  resource_name: string;
  capacity: number;
};

type RefItem = { id: string; branch_name?: string; service_name?: string };
type DayCell = { iso: string; day: number; inMonth: boolean };

const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

function pad2(n: number) { return String(n).padStart(2, '0'); }
function toISO(date: Date) { return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`; }
function monthTitle(date: Date) { return date.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }); }
function hhmm(v?: string | null) { return String(v ?? '00:00').slice(0, 5); }
function timeToHour(v?: string | null) {
  const t = hhmm(v);
  const [h, m] = t.split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) + ((Number.isFinite(m) ? m : 0) / 60);
}

function statusClass(status: string) {
  if (status === 'completed') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'serving') return 'border-cyan-200 bg-cyan-50 text-cyan-700';
  if (status === 'waiting') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'confirmed') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (status === 'pending') return 'border-orange-200 bg-orange-50 text-orange-700';
  if (status === 'cancelled') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function blockColor(status: string) {
  if (status === 'confirmed' || status === 'waiting' || status === 'serving') return 'bg-blue-500 text-white';
  if (status === 'cancelled' || status === 'no_show') return 'bg-rose-400 text-white';
  return 'bg-emerald-500 text-white';
}

function buildMonthGrid(baseMonth: Date): DayCell[] {
  const first = new Date(baseMonth.getFullYear(), baseMonth.getMonth(), 1);
  const startOffset = first.getDay();
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - startOffset);
  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({ iso: toISO(d), day: d.getDate(), inMonth: d.getMonth() === baseMonth.getMonth() });
  }
  return cells;
}

export function CalendarClient() {
  const { push } = useToast();
  const today = new Date();
  const [view, setView] = useState<'month' | 'resource'>('month');
  /** Which kind of resource gets one lane per row in the timeline view. */
  const [laneType, setLaneType] = useState<ResourceType>('meeting_room');
  const [monthCursor, setMonthCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(toISO(today));
  const [meetingDate, setMeetingDate] = useState<string>(toISO(today));
  const [branches, setBranches] = useState<RefItem[]>([]);
  const [services, setServices] = useState<RefItem[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  // Branch selection is shared with the topbar switcher so both views agree.
  const { branchId, setBranchId } = useBranchScope();
  const [serviceId, setServiceId] = useState('');

  const firstOfMonth = useMemo(() => toISO(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1)), [monthCursor]);
  const lastOfMonth = useMemo(() => toISO(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0)), [monthCursor]);

  const loadMonth = useCallback(async () => {
    const params = new URLSearchParams({ from: firstOfMonth, to: lastOfMonth });
    if (branchId) params.set('branch_id', branchId);
    const res = await fetch(`/api/calendar?${params.toString()}`, { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'โหลดปฏิทินไม่สำเร็จ', 'error');
    setRows((json.data ?? []) as Row[]);
  }, [firstOfMonth, lastOfMonth, branchId, push]);

  const loadRefs = useCallback(async () => {
    const [bRes, sRes] = await Promise.all([
      fetch('/api/branches?page_size=200', { cache: 'no-store' }),
      fetch('/api/services?page_size=200', { cache: 'no-store' }),
    ]);
    const [bJson, sJson] = await Promise.all([bRes.json(), sRes.json()]);
    if (bRes.ok) setBranches(bJson.data ?? []);
    if (sRes.ok) setServices(sJson.data ?? []);
  }, []);

  const loadMeeting = useCallback(async () => {
    const params = new URLSearchParams({ from: meetingDate, to: meetingDate });
    if (branchId) params.set('branch_id', branchId);
    if (serviceId) params.set('service_id', serviceId);
    const [calRes, resourceRes] = await Promise.all([
      fetch(`/api/calendar?${params.toString()}`, { cache: 'no-store' }),
      fetch(`/api/resources?resource_type=${laneType}${branchId ? `&branch_id=${branchId}` : ''}&page_size=300`, { cache: 'no-store' }),
    ]);
    const [calJson, resourceJson] = await Promise.all([calRes.json(), resourceRes.json()]);
    if (!calRes.ok) return push(calJson.error ?? 'โหลดปฏิทินไม่สำเร็จ', 'error');
    if (!resourceRes.ok) return push(resourceJson.error ?? `โหลด${resourceTypeLabel(laneType)}ไม่สำเร็จ`, 'error');
    setRows((calJson.data ?? []) as Row[]);
    setResources((resourceJson.data ?? []) as Resource[]);
  }, [branchId, laneType, meetingDate, push, serviceId]);

  useEffect(() => { void loadRefs(); }, [loadRefs]);
  useEffect(() => { if (view === 'month') void loadMonth(); }, [loadMonth, view]);
  useEffect(() => { if (view === 'resource') void loadMeeting(); }, [loadMeeting, view]);

  const rowsByDate = useMemo(() => {
    const map = new Map<string, Row[]>();
    rows.forEach((r) => {
      const list = map.get(r.booking_date) ?? [];
      list.push(r);
      map.set(r.booking_date, list);
    });
    map.forEach((list) => list.sort((a, b) => String(a.start_time).localeCompare(String(b.start_time))));
    return map;
  }, [rows]);

  const laneLabel = resourceTypeLabel(laneType);
  const monthCells = useMemo(() => buildMonthGrid(monthCursor), [monthCursor]);
  const selectedRows = rowsByDate.get(selectedDate) ?? [];
  const todayIso = toISO(today);

  const meetingRows = useMemo(() => {
    const byResource = new Map<string, Row[]>();
    (rows ?? []).forEach((r) => {
      const key = String(r.resource_id ?? r.resource_name ?? 'unassigned');
      const list = byResource.get(key) ?? [];
      list.push(r);
      byResource.set(key, list);
    });
    byResource.forEach((list) => list.sort((a, b) => String(a.start_time).localeCompare(String(b.start_time))));
    return byResource;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs text-slate-500">Calendar</p>
            <h3 className="text-lg font-semibold text-slate-800">{view === 'month' ? monthTitle(monthCursor) : `ตาราง${laneLabel} ${formatDateDMY(meetingDate)}`}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className={view === 'month' ? 'btn-primary inline-flex items-center gap-1' : 'btn-outline inline-flex items-center gap-1'} onClick={() => setView('month')}>
              <CalendarMonthRoundedIcon fontSize="small" /> เดือน
            </button>
            <button className={view === 'resource' ? 'btn-primary inline-flex items-center gap-1' : 'btn-outline inline-flex items-center gap-1'} onClick={() => setView('resource')}>
              <MeetingRoomRoundedIcon fontSize="small" /> ตารางทรัพยากร
            </button>
            {view === 'resource' ? (
              <select
                className="input text-sm w-full sm:w-40"
                value={laneType}
                onChange={(e) => setLaneType(e.target.value as ResourceType)}
              >
                {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{resourceTypeLabel(t)}</option>)}
              </select>
            ) : null}
          </div>
        </div>
      </div>

      {view === 'month' ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-end gap-2 border-b border-slate-200 p-3">
              <button className="btn-outline inline-flex items-center gap-1" aria-label="เดือนก่อน" onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}><ChevronLeftRoundedIcon fontSize="small" /><span className="hidden sm:inline">เดือนก่อน</span></button>
              <button className="btn-outline inline-flex items-center gap-1" onClick={() => { const now = new Date(); setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(toISO(now)); }}><TodayRoundedIcon fontSize="small" />วันนี้</button>
              <button className="btn-outline inline-flex items-center gap-1" aria-label="เดือนถัดไป" onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}><span className="hidden sm:inline">เดือนถัดไป</span><ChevronRightRoundedIcon fontSize="small" /></button>
            </div>
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">{WEEKDAYS.map((w) => <div key={w} className="px-1 py-2 text-center text-xs font-semibold text-slate-600 sm:px-3">{w}</div>)}</div>
            {/* Phones: compact cells (day number + count badge); the day's bookings are listed in the aside below. sm+: original cells with chips. */}
            <div className="grid grid-cols-7">
              {monthCells.map((cell) => {
                const list = rowsByDate.get(cell.iso) ?? [];
                const isToday = cell.iso === todayIso;
                const isSelected = cell.iso === selectedDate;
                return (
                  <button key={cell.iso} className={`min-h-14 border-b border-r border-slate-100 p-1 text-left transition hover:bg-slate-50 sm:min-h-32 sm:p-2 ${cell.inMonth ? 'bg-white' : 'bg-slate-50/70'} ${isSelected ? 'ring-2 ring-inset ring-emerald-400' : ''}`} onClick={() => setSelectedDate(cell.iso)}>
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-0.5">
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? 'bg-emerald-600 text-white' : cell.inMonth ? 'text-slate-800' : 'text-slate-400'}`}>{cell.day}</span>
                      {list.length > 0 ? (
                        <>
                          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-semibold text-white sm:hidden" aria-label={`${list.length} คิว`}>{list.length}</span>
                          <span className="hidden text-[10px] font-medium text-slate-500 sm:inline">{list.length} คิว</span>
                        </>
                      ) : null}
                    </div>
                    <div className="hidden space-y-1 sm:block">
                      {list.slice(0, 3).map((item) => <div key={item.id} className={`truncate rounded-md border px-1.5 py-1 text-[10px] ${statusClass(String(item.status))}`}><span className="font-semibold">{hhmm(item.start_time)}</span> {item.queue_number}</div>)}
                      {list.length > 3 ? <p className="text-[10px] text-slate-500">+ อีก {list.length - 3} รายการ</p> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="card p-4">
            <h4 className="text-sm font-semibold text-slate-800">รายละเอียดวันที่ {formatDateDMY(selectedDate)}</h4>
            <p className="mt-1 text-xs text-slate-500">ทั้งหมด {selectedRows.length} คิว</p>
            <div className="mt-3 space-y-2">
              {selectedRows.length === 0 ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">ไม่มีคิวในวันที่เลือก</div> : selectedRows.map((r) => (
                <div key={r.id} className={`rounded-xl border p-3 text-xs ${statusClass(String(r.status))}`}>
                  <div className="flex items-center justify-between gap-2"><p className="font-semibold text-slate-900">{r.queue_number}</p><span className="rounded-full border border-current/20 px-2 py-0.5">{r.status}</span></div>
                  <p className="mt-1 text-slate-700">{hhmm(r.start_time)} • {customerLabel(r.customers)}</p>
                  <p className="text-slate-600">{r.branches?.branch_name ?? '-'} • {r.services?.service_name ?? '-'}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      ) : (
        <section className="card p-4 overflow-x-auto">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input className="input" type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
            <select className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">ทุกสาขา</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name ?? b.id}</option>)}
            </select>
            <select className="input" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">ทุกบริการ</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.service_name ?? s.id}</option>)}
            </select>
            <button className="btn-outline" onClick={() => void loadMeeting()}>รีเฟรช</button>
            <div className="ml-auto flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-emerald-400" />ว่าง</span>
              <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-rose-400" />ไม่ว่าง</span>
              <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-blue-500" />จองแล้ว</span>
            </div>
          </div>

          {resources.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              ยังไม่มี{laneLabel}ในระบบ — เพิ่มได้ที่เมนู “ทรัพยากร”
            </p>
          ) : null}

          <div className="min-w-[980px] overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid" style={{ gridTemplateColumns: '200px repeat(10, minmax(0,1fr))' }}>
              <div className="border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">{laneLabel} / เวลา</div>
              {HOURS.map((h) => <div key={h} className="border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-center text-sm font-semibold text-slate-700">{pad2(h)}:00</div>)}

              {resources.map((room) => {
                const roomBookings = meetingRows.get(room.id) ?? [];
                return (
                  <Fragment key={room.id}>
                    <div key={`${room.id}-label`} className="border-b border-r border-slate-200 bg-white px-3 py-3">
                      <p className="font-semibold text-slate-800">{room.resource_name}</p>
                      {isPersonResourceType(room.resource_type)
                        ? null
                        : <p className="text-xs text-slate-500">({room.capacity} ที่นั่ง)</p>}
                    </div>
                    <div key={`${room.id}-grid`} className="relative col-span-10 h-20 border-b border-slate-200 bg-[#eaf4e7]">
                      <div className="absolute inset-0 grid" style={{ gridTemplateColumns: 'repeat(10, minmax(0,1fr))' }}>
                        {HOURS.map((h) => <div key={`${room.id}-${h}`} className="border-r border-white/70" />)}
                      </div>
                      {roomBookings.map((b) => {
                        const startH = timeToHour(b.start_time);
                        const endH = timeToHour(b.end_time || b.start_time) || (startH + 1);
                        const left = Math.max(0, ((startH - 8) / 10) * 100);
                        const width = Math.max(8, ((Math.max(endH, startH + 0.5) - Math.max(startH, 8)) / 10) * 100);
                        return (
                          <div
                            key={b.id}
                            className={`absolute top-1.5 h-[74px] rounded-xl px-2 py-1 text-xs shadow-sm ${blockColor(b.status)}`}
                            style={{ left: `${left}%`, width: `${width}%` }}
                            title={`${hhmm(b.start_time)}-${hhmm(b.end_time || b.start_time)} ${customerLabel(b.customers)} ${b.services?.service_name ?? ''}`}
                          >
                            <p className="font-semibold">{hhmm(b.start_time)} - {hhmm(b.end_time || b.start_time)}</p>
                            <p className="truncate opacity-95">{b.customers ? customerLabel(b.customers) : b.queue_number}</p>
                          </div>
                        );
                      })}
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
