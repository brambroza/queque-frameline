'use client';

import { useCallback, useEffect, useState } from 'react';
import { DoDocument, type DoDocumentData } from '@/components/delivery-order/do-document';
import { BookingCard } from './booking-card';
import { LineBanner, type LineMeta } from './line-banner';
import { AlertsBanner } from './alerts-banner';
import { useLiffBind } from './use-liff-bind';
import { useDriverAlerts } from './use-driver-alerts';
import { TERMINAL_STATUSES } from '@/lib/booking/status-flow';
import type { PublicBooking } from './types';

type DriverData = {
  site: { name: string; phone: string | null; address: string | null };
  booking: PublicBooking;
  can_self_check_in: boolean;
  check_in_requires_location?: boolean;
  check_in_radius_m?: number | null;
  early_arrival_minutes: number;
  grace_minutes: number;
  auto_no_show_after_grace?: boolean;
  push?: { enabled: boolean; public_key: string | null };
  line?: LineMeta;
};

const POLL_MS = 10_000;

type Fix = { lat: number; lng: number; accuracy: number };

/** One high-accuracy GPS fix; rejects with a Thai message the driver can act on. */
function getPosition(): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return reject(new Error('โทรศัพท์นี้ไม่รองรับการระบุตำแหน่ง กรุณาแจ้งเจ้าหน้าที่หน้าประตู'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(new Error(
        err.code === err.PERMISSION_DENIED ? 'ต้องอนุญาตให้เข้าถึงตำแหน่งก่อน — เปิดสิทธิ์ตำแหน่งของเบราว์เซอร์/LINE ในการตั้งค่าโทรศัพท์แล้วลองใหม่'
        : err.code === err.TIMEOUT ? 'หาตำแหน่งไม่ทัน กรุณาเปิด GPS ออกมาที่โล่งแล้วลองใหม่'
        : 'อ่านตำแหน่งไม่ได้ กรุณาเปิด GPS แล้วลองใหม่',
      )),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  });
}

/** Driver's page: which job, which dock, live status, and the DO to show at the gate. */
export function DriverClient({ token }: { token: string }) {
  const api = `/api/public/driver/${encodeURIComponent(token)}`;
  const [data, setData] = useState<DriverData | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const lineBind = useLiffBind(data?.line?.liff_id, `${api}/line-link`);
  const alerts = useDriverAlerts(api);
  const { observe } = alerts;

  const load = useCallback(async (silent = false) => {
    try {
      const res = await fetch(api, { cache: 'no-store' });
      const j = (await res.json()) as { data?: DriverData; error?: string };
      if (!res.ok || !j.data) { if (!silent) setFatal(j.error ?? 'เปิดลิงก์ไม่สำเร็จ'); return; }
      setData(j.data);
      observe(j.data.booking, j.data.push?.public_key);
    } catch {
      if (!silent) setFatal('เชื่อมต่อไม่ได้ กรุณาลองใหม่');
    }
  }, [api, observe]);

  useEffect(() => { void load(); const id = setInterval(() => void load(true), POLL_MS); return () => clearInterval(id); }, [load]);

  // Coming back to the tab (screen unlocked, app switched) should not wait for the next tick.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void load(true); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  async function arrive() {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      let fix: Fix | null = null;
      if (data?.check_in_requires_location) {
        setNotice('กำลังตรวจตำแหน่ง…');
        try { fix = await getPosition(); } catch (e) { setNotice(e instanceof Error ? e.message : 'อ่านตำแหน่งไม่ได้'); return; }
      }
      const res = await fetch(`${api}/arrive`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fix ?? {}) });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setNotice(res.ok ? 'เช็คอินแล้ว — รอเรียกเข้าท่า' : j.error ?? 'เช็คอินไม่สำเร็จ');
      await load(true);
    } catch {
      setNotice('เชื่อมต่อไม่ได้ กรุณาลองใหม่');
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

        <LineBanner line={data.line} state={lineBind.state} viaLine={lineBind.viaLine} path={`/driver/${encodeURIComponent(token)}`} who="driver" />
        {!(TERMINAL_STATUSES as readonly string[]).includes(b.status) ? (
          <AlertsBanner state={alerts.state} lineBound={lineBind.state.phase === 'bound' || Boolean(data.line?.linked_name)} onEnable={() => void alerts.enable()} onDisable={() => void alerts.disable()} />
        ) : null}

        {b.status === 'called' ? (
          <div className="rounded-2xl bg-sky-600 p-5 text-center text-white" role="status">
            <p className="text-sm">ถึงคิวของคุณแล้ว{(b.call_count ?? 1) > 1 ? ` (เรียกครั้งที่ ${b.call_count})` : ''}</p>
            <p className="text-3xl font-extrabold">เชิญเข้า{b.resource_name ?? 'ท่า'}</p>
          </div>
        ) : null}
        {b.status === 'checked_in' && b.wait_notified_at ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900" role="status">
            <p className="font-semibold">คิวล่าช้ากว่ากำหนด — {b.resource_name ?? 'ท่า'}ยังไม่ว่าง</p>
            <p className="mt-1 text-sm">กรุณารอในลานจอดสักครู่ ระบบจะแจ้งทันทีเมื่อถึงคิวของคุณ ขออภัยในความล่าช้า</p>
          </div>
        ) : null}
        {b.status === 'late' ? (
          <div className="rounded-2xl border border-orange-300 bg-orange-50 p-4 text-orange-900" role="status">
            <p className="font-semibold">เลยเวลานัด {b.start_time.slice(0, 5)} น. แล้ว — ยังเข้าได้</p>
            <p className="mt-1 text-sm">{data.auto_no_show_after_grace ? `ต้องมาถึงและเช็คอินภายใน ${data.grace_minutes} นาที ไม่เช่นนั้นระบบจะปิดคิวอัตโนมัติ` : 'กรุณารีบมาถึงคลัง หรือติดต่อเจ้าหน้าที่หากต้องการเลื่อนคิว'}</p>
          </div>
        ) : null}

        <BookingCard b={b} />

        {notice ? <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700" role="status">{notice}</p> : null}
        {data.can_self_check_in && data.check_in_requires_location ? (
          <p className="text-center text-xs text-slate-500">กดได้เมื่ออยู่ในระยะ {data.check_in_radius_m ?? 300} ม. จากคลัง · ระบบจะขอตำแหน่งจากโทรศัพท์</p>
        ) : null}
        {data.can_self_check_in ? (
          <button type="button" disabled={busy} onClick={() => void arrive()} className="min-h-[52px] w-full rounded-xl bg-emerald-600 text-lg font-semibold text-white active:bg-emerald-700 disabled:bg-slate-300">
            {busy ? 'กำลังเช็คอิน…' : 'ฉันมาถึงแล้ว — เช็คอิน'}
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
