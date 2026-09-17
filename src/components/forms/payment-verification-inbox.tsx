'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDateDMY } from '@/lib/utils/date-format';
import { customerLabel } from '@/lib/booking/customer-label';
import type { SlipStatus } from '@/types/db';

type SlipRow = {
  id: string;
  booking_id: string;
  status: SlipStatus;
  amount_claimed: number | null;
  transferred_at: string | null;
  reject_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  image_url: string | null;
  bookings?: {
    queue_number?: string;
    booking_date?: string;
    start_time?: string;
    payment_amount?: number | null;
    payment_status?: string | null;
    customers?: { full_name?: string | null; nickname?: string | null; phone?: string | null } | null;
  } | null;
};

const TABS: Array<{ key: SlipStatus; label: string }> = [
  { key: 'pending', label: 'รอตรวจสอบ' },
  { key: 'approved', label: 'อนุมัติแล้ว' },
  { key: 'rejected', label: 'ปฏิเสธ' },
];

const REJECT_PRESETS = ['ยอดเงินไม่ตรง', 'รูปไม่ชัด อ่านไม่ออก', 'ไม่พบรายการโอนเข้าบัญชี'];

function formatTHB(amount: number | null | undefined) {
  return Number(amount ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Review queue for customer-uploaded transfer slips.
 *
 * A dedicated page rather than a tab inside the bookings grid: the queue is
 * "everything still waiting, oldest first, across all dates", which the
 * date-filtered bookings view cannot express.
 */
export function PaymentVerificationInbox({ initialBookingId }: { initialBookingId?: string }) {
  const { push } = useToast();
  const [tab, setTab] = useState<SlipStatus>('pending');
  const [rows, setRows] = useState<SlipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SlipRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [acting, setActing] = useState(false);
  const [bookingFilter, setBookingFilter] = useState(initialBookingId ?? '');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ status: tab });
      if (bookingFilter) qs.set('booking_id', bookingFilter);
      const res = await fetch(`/api/payment-slips?${qs.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'โหลดข้อมูลไม่สำเร็จ');
      setRows((json.data ?? []) as SlipRow[]);
    } catch (e) {
      push(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ', 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, bookingFilter, push]);

  useEffect(() => { void load(); }, [load]);

  async function review(slip: SlipRow, action: 'approve' | 'reject') {
    if (action === 'reject' && !rejectReason.trim()) {
      return push('กรุณาระบุเหตุผลที่ปฏิเสธ', 'error');
    }
    setActing(true);
    try {
      const res = await fetch(`/api/payment-slips/${slip.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reject_reason: action === 'reject' ? rejectReason.trim() : undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'ดำเนินการไม่สำเร็จ');
      push(action === 'approve' ? 'ยืนยันการชำระเงินแล้ว' : 'ปฏิเสธสลิปแล้ว');
      setSelected(null);
      setRejectReason('');
      await load();
    } catch (e) {
      push(e instanceof Error ? e.message : 'ดำเนินการไม่สำเร็จ', 'error');
    } finally {
      setActing(false);
    }
  }

  const expected = Number(selected?.bookings?.payment_amount ?? 0);
  const claimed = Number(selected?.amount_claimed ?? 0);
  const amountMismatch = Boolean(selected?.amount_claimed) && claimed !== expected;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'btn-primary !py-1.5 !text-sm' : 'btn-outline !py-1.5 !text-sm'}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
        {bookingFilter && (
          <button className="btn-outline !py-1.5 !text-sm" onClick={() => setBookingFilter('')}>
            ล้างตัวกรองคิว
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">กำลังโหลด...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="ไม่มีรายการ" description={tab === 'pending' ? 'ยังไม่มีสลิปรอตรวจสอบ' : 'ไม่มีรายการในสถานะนี้'} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">คิว</th>
                <th className="px-3 py-2 text-left">ลูกค้า</th>
                <th className="px-3 py-2 text-left">วันเวลาจอง</th>
                <th className="px-3 py-2 text-right">ยอดที่ต้องจ่าย</th>
                <th className="px-3 py-2 text-right">ยอดที่แจ้ง</th>
                <th className="px-3 py-2 text-left">อัปโหลดเมื่อ</th>
                <th className="px-3 py-2 text-left">สลิป</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const mismatch = Boolean(r.amount_claimed) && Number(r.amount_claimed) !== Number(r.bookings?.payment_amount ?? 0);
                return (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-900">{r.bookings?.queue_number ?? '-'}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {customerLabel(r.bookings?.customers)}
                      <span className="block text-xs text-slate-400">{r.bookings?.customers?.phone ?? ''}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {r.bookings?.booking_date ? formatDateDMY(r.bookings.booking_date) : '-'}
                      {' '}{String(r.bookings?.start_time ?? '').slice(0, 5)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">{formatTHB(r.bookings?.payment_amount)}</td>
                    <td className={`px-3 py-2 text-right ${mismatch ? 'font-semibold text-rose-600' : 'text-slate-700'}`}>
                      {r.amount_claimed ? formatTHB(r.amount_claimed) : '-'}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{formatDateTime(r.created_at)}</td>
                    <td className="px-3 py-2">
                      {r.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.image_url} alt="สลิป" className="h-12 w-12 rounded object-cover" />
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button className="btn-outline !py-1 !text-xs" onClick={() => { setSelected(r); setRejectReason(r.reject_reason ?? ''); }}>
                        {r.status === 'pending' ? 'ตรวจสอบ' : 'ดูรายละเอียด'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setSelected(null)}>
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">คิว {selected.bookings?.queue_number ?? '-'}</h2>
                <p className="text-xs text-slate-500">{customerLabel(selected.bookings?.customers)} {selected.bookings?.customers?.phone ?? ''}</p>
              </div>
              <button className="text-slate-400" onClick={() => setSelected(null)}>✕</button>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-xs text-slate-500">ยอดที่ต้องจ่าย</dt><dd className="font-semibold text-slate-900">{formatTHB(selected.bookings?.payment_amount)} บาท</dd></div>
              <div><dt className="text-xs text-slate-500">ยอดที่ลูกค้าแจ้ง</dt><dd className={amountMismatch ? 'font-semibold text-rose-600' : 'font-semibold text-slate-900'}>{selected.amount_claimed ? `${formatTHB(selected.amount_claimed)} บาท` : '-'}</dd></div>
              <div><dt className="text-xs text-slate-500">เวลาที่โอน</dt><dd className="text-slate-700">{formatDateTime(selected.transferred_at)}</dd></div>
              <div><dt className="text-xs text-slate-500">อัปโหลดเมื่อ</dt><dd className="text-slate-700">{formatDateTime(selected.created_at)}</dd></div>
            </dl>

            {amountMismatch && (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                ⚠️ ยอดที่ลูกค้าแจ้งไม่ตรงกับยอดที่ต้องชำระ — ตรวจสอบสลิปให้ละเอียด
              </p>
            )}

            {selected.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.image_url} alt="สลิปเต็ม" className="mt-4 w-full rounded-xl border border-slate-200" />
            ) : (
              <p className="mt-4 text-sm text-slate-500">ไม่สามารถแสดงรูปสลิปได้ (ลิงก์หมดอายุ กรุณารีเฟรช)</p>
            )}

            {selected.status === 'pending' ? (
              <div className="mt-5 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">เหตุผล (กรอกเมื่อปฏิเสธ)</label>
                  <div className="flex flex-wrap gap-1">
                    {REJECT_PRESETS.map((preset) => (
                      <button key={preset} className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600" onClick={() => setRejectReason(preset)}>
                        {preset}
                      </button>
                    ))}
                  </div>
                  <input className="input" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="ระบุเหตุผล" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn-outline" disabled={acting} onClick={() => void review(selected, 'reject')}>ปฏิเสธ</button>
                  <button className="btn-primary" disabled={acting} onClick={() => void review(selected, 'approve')}>
                    {acting ? 'กำลังบันทึก...' : 'อนุมัติ'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                สถานะ: {selected.status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธ'}
                {selected.reject_reason ? ` — ${selected.reject_reason}` : ''}
                <span className="block text-xs text-slate-400">ตรวจสอบเมื่อ {formatDateTime(selected.reviewed_at)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
