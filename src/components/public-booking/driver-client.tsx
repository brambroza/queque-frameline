'use client';

import { useCallback, useEffect, useState } from 'react';
import { DoDocument, type DoDocumentData } from '@/components/delivery-order/do-document';
import { BookingCard } from './booking-card';
import type { PublicBooking } from './types';

type DriverData = {
  site: { name: string; phone: string | null; address: string | null };
  booking: PublicBooking;
  can_self_check_in: boolean;
  early_arrival_minutes: number;
  grace_minutes: number;
};

const POLL_MS = 10_000;

/** Driver's page: which job, which dock, live status, and the DO to show at the gate. */
export function DriverClient({ token }: { token: string }) {
  const api = `/api/public/driver/${encodeURIComponent(token)}`;
  const [data, setData] = useState<DriverData | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    try {
      const res = await fetch(api, { cache: 'no-store' });
      const j = (await res.json()) as { data?: DriverData; error?: string };
      if (!res.ok || !j.data) { if (!silent) setFatal(j.error ?? 'เปิดลิงก์ไม่สำเร็จ'); return; }
      setData(j.data);
    } catch {
      if (!silent) setFatal('เชื่อมต่อไม่ได้ กรุณาลองใหม่');
    }
  }, [api]);

  useEffect(() => { void load(); const id = setInterval(() => void load(true), POLL_MS); return () => clearInterval(id); }, [load]);

  async function arrive() {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`${api}/arrive`, { method: 'POST' });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setNotice(res.ok ? 'แจ้งเจ้าหน้าที่แล้วว่ารถมาถึง' : j.error ?? 'เช็คอินไม่สำเร็จ');
      await load(true);
    } finally {
      setBusy(false);
    }
  }

  if (fatal) return <main className="min-h-screen bg-slate-50 p-5"><div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">{fatal}</div></main>;
  if (!data) return <main className="min-h-screen bg-slate-50 p-5"><div className="mx-auto h-48 max-w-xl animate-pulse rounded-2xl bg-slate-200" /></main>;

  const b = data.booking;
  const doData: DoDocumentData = {
    siteName: data.site.name,
    doNumber: b.do_number,
    queueNumber: b.queue_number,
    direction: b.direction,
    docNo: b.external_documents?.doc_no ?? null,
    partnerName: b.external_documents?.partner_name ?? null,
    bookingDate: b.booking_date,
    startTime: b.start_time,
    endTime: b.end_time,
    dockName: b.resource_name,
    vehicleType: b.services?.service_name ?? null,
    plate: b.plate_number_actual || b.plate_number,
    driverName: b.driver_name,
    driverPhone: b.driver_phone,
    receiverName: b.receiver_name,
    receiverPhone: b.receiver_phone,
    note: b.note,
    issuedAt: b.do_issued_at,
    items: b.external_documents?.items ?? [],
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-5">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">{b.direction === 'outbound' ? 'งานรับสินค้า' : 'งานส่งสินค้า'}</h1>
          <p className="text-sm text-slate-500">{data.site.name}{data.site.address ? ` · ${data.site.address}` : ''}</p>
        </header>

        {b.status === 'called' ? (
          <div className="rounded-2xl bg-sky-600 p-5 text-center text-white" role="status">
            <p className="text-sm">ถึงคิวของคุณแล้ว</p>
            <p className="text-3xl font-extrabold">เชิญเข้า{b.resource_name ?? 'ท่า'}</p>
          </div>
        ) : null}

        <BookingCard b={b} />

        {notice ? <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700" role="status">{notice}</p> : null}
        {data.can_self_check_in ? (
          <button type="button" disabled={busy} onClick={() => void arrive()} className="min-h-[52px] w-full rounded-xl bg-emerald-600 text-lg font-semibold text-white active:bg-emerald-700 disabled:bg-slate-300">
            {busy ? 'กำลังแจ้ง…' : 'ฉันมาถึงแล้ว'}
          </button>
        ) : ['confirmed', 'late'].includes(b.status) ? (
          <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-600">เมื่อมาถึง แจ้งเลขคิว <b>{b.queue_number}</b> ที่ป้อมยามเพื่อเช็คอิน · มาก่อนเวลาได้ไม่เกิน {data.early_arrival_minutes} นาที</p>
        ) : null}

        {b.do_number ? (
          <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <div style={{ minWidth: 640 }}><DoDocument data={doData} /></div>
          </section>
        ) : null}

        <footer className="pb-6 text-center text-xs text-slate-500">{data.site.phone ? `ติดต่อคลัง โทร ${data.site.phone}` : ''}</footer>
      </div>
    </main>
  );
}
