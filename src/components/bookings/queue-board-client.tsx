'use client';

import { useCallback, useEffect, useState } from 'react';
import HourglassBottomRoundedIcon from '@mui/icons-material/HourglassBottomRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import PlayCircleRoundedIcon from '@mui/icons-material/PlayCircleRounded';
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';
import { useToast } from '@/components/ui/toast';
import { customerLabel } from '@/lib/booking/customer-label';
import { ActionIconGroup } from '@/components/ui/action-icon-group';
import type { BookingStatus } from '@/types/db';

type Booking = {
  id: string;
  queue_number: string;
  booking_date: string;
  start_time: string;
  status: BookingStatus;
  resource_name?: string | null;
  line_user_id?: string | null;
  checked_in_at?: string | null;
  call_count?: number | null;
  customers: { full_name?: string | null; nickname?: string | null } | null;
  services: { service_name?: string } | null;
};

/**
 * Kanban columns. `checked_in` (customer tapped "ฉันมาถึงแล้ว") sits with
 * `waiting` because both mean "on site, not yet called".
 */
const COLUMNS: Array<{ key: string; label: string; statuses: BookingStatus[] }> = [
  { key: 'confirmed', label: 'ยืนยันแล้ว', statuses: ['confirmed'] },
  { key: 'waiting', label: 'รอเรียก', statuses: ['waiting', 'checked_in'] },
  { key: 'called', label: 'กำลังเรียก', statuses: ['called'] },
  { key: 'serving', label: 'กำลังให้บริการ', statuses: ['serving'] },
  { key: 'completed', label: 'เสร็จสิ้น', statuses: ['completed'] },
];

type PatchResponse = { error?: string; data?: { line_notified?: boolean } };

export function QueueBoardClient() {
  const { push } = useToast();
  const [rows, setRows] = useState<Booking[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    const res = await fetch(`/api/bookings?date=${date}`, { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'โหลดคิวไม่สำเร็จ', 'error');
    setRows(json.data ?? []);
  }, [date, push]);

  useEffect(() => { void load(); }, [load]);

  async function setStatus(b: Booking, status: BookingStatus) {
    const res = await fetch('/api/bookings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: b.id, status }),
    });
    const json = (await res.json().catch(() => ({}))) as PatchResponse;
    if (!res.ok) return push(json.error ?? 'เปลี่ยนสถานะไม่สำเร็จ', 'error');
    if (status === 'called') {
      if (json.data?.line_notified) push('เรียกคิวแล้ว และแจ้งลูกค้าทาง LINE');
      else if (b.line_user_id) push('เรียกคิวแล้ว แต่ส่ง LINE ไม่สำเร็จ — กรุณาเรียกลูกค้าเอง', 'error');
      else push('เรียกคิวแล้ว (คิวไม่ได้ผูก LINE กรุณาเรียกลูกค้าเอง)');
    }
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <label className="text-sm">Date<input className="input mt-1 max-w-[220px]" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        {COLUMNS.map((col) => {
          const items = rows.filter((r) => col.statuses.includes(r.status));
          return (
            <section key={col.key} className="card p-3">
              <h3 className="mb-2 text-sm font-semibold">{col.label}</h3>
              <div className="space-y-2">
                {items.map((r) => (
                  <article key={r.id} className="rounded-lg border border-slate-200 p-2 text-sm">
                    <p className="font-semibold">{r.queue_number}</p>
                    <p>{String(r.start_time).slice(0, 5)} - {customerLabel(r.customers)}</p>
                    <p className="text-xs text-slate-600">{r.services?.service_name ?? '-'}</p>
                    {r.resource_name ? <p className="text-xs text-slate-500">👤 {r.resource_name}</p> : null}
                    {r.status === 'checked_in' ? <p className="text-xs text-violet-600">ลูกค้ามาถึงแล้ว</p> : null}
                    {r.status === 'called' && Number(r.call_count ?? 0) > 1 ? <p className="text-xs text-amber-600">เรียกแล้ว {r.call_count} ครั้ง</p> : null}
                    <div className="mt-2 flex justify-end">
                      <ActionIconGroup
                        actions={[
                          {
                            key: 'waiting',
                            hidden: col.key !== 'confirmed',
                            icon: <HourglassBottomRoundedIcon fontSize="small" />,
                            labelKey: 'status.waiting',
                            fallbackLabel: 'รอเรียก',
                            color: 'warning',
                            onClick: () => void setStatus(r, 'waiting'),
                          },
                          {
                            key: 'call',
                            hidden: !(col.key === 'confirmed' || col.key === 'waiting'),
                            icon: <CampaignRoundedIcon fontSize="small" />,
                            labelKey: 'status.called',
                            fallbackLabel: 'เรียกคิว',
                            color: 'info',
                            onClick: () => void setStatus(r, 'called'),
                          },
                          {
                            key: 'recall',
                            hidden: col.key !== 'called',
                            icon: <NotificationsActiveRoundedIcon fontSize="small" />,
                            fallbackLabel: 'เรียกซ้ำ',
                            color: 'warning',
                            onClick: () => void setStatus(r, 'called'),
                          },
                          {
                            key: 'serving',
                            hidden: !(col.key === 'waiting' || col.key === 'called'),
                            icon: <PlayCircleRoundedIcon fontSize="small" />,
                            labelKey: 'status.serving',
                            fallbackLabel: 'เริ่มบริการ',
                            color: 'info',
                            onClick: () => void setStatus(r, 'serving'),
                          },
                          {
                            key: 'completed',
                            hidden: col.key !== 'serving',
                            icon: <DoneAllRoundedIcon fontSize="small" />,
                            labelKey: 'bookings.complete',
                            fallbackLabel: 'เสร็จสิ้น',
                            color: 'success',
                            onClick: () => void setStatus(r, 'completed'),
                          },
                        ]}
                      />
                    </div>
                  </article>
                ))}
                {items.length === 0 ? <p className="text-xs text-slate-400">ไม่มีคิว</p> : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
