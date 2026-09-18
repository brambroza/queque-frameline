'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { isPlausiblePlate } from '@/lib/booking/plate';
import { BookingCard } from './booking-card';
import { LineBanner, type LineMeta } from './line-banner';
import { useLiffBind } from './use-liff-bind';
import { longThaiDate, shortThaiDate, type PublicBooking, type PublicItem } from './types';

type Meta = {
  site: { name: string; branch: string | null; phone: string | null; address: string | null };
  document: { doc_no: string; doc_type: 'so' | 'po'; status: string; partner_name: string | null; due_date: string | null; remark: string | null; items: PublicItem[] };
  direction: 'inbound' | 'outbound';
  open: boolean;
  vehicle_types: Array<{ id: string; service_name: string; duration_minutes: number }>;
  rules: { lead_hours: number; horizon_days: number; require_admin_confirm: boolean; grace_minutes: number; early_arrival_minutes: number };
  line?: LineMeta;
  bookings: PublicBooking[];
};
type Day = { day: string; open_slots: number };
type Slot = { slot_time: string; slot_end: string; capacity: number; remaining_capacity: number; is_past: boolean; too_soon: boolean; bookable: boolean };
type Step = 'status' | 'vehicle' | 'date' | 'slot' | 'details' | 'confirm';
type Details = { plate_number: string; driver_name: string; driver_phone: string; receiver_name: string; receiver_phone: string; note: string };

const EMPTY_DETAILS: Details = { plate_number: '', driver_name: '', driver_phone: '', receiver_name: '', receiver_phone: '', note: '' };
const LIVE = new Set(['pending', 'confirmed', 'late', 'checked_in', 'called', 'serving']);
const PHONE = /^[0-9+\-\s()]{8,20}$/;
const btnPrimary = 'min-h-[48px] w-full rounded-xl bg-emerald-600 px-4 text-base font-semibold text-white active:bg-emerald-700 disabled:bg-slate-300';
const btnGhost = 'min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 active:bg-slate-100';
const inputCls = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none focus:border-emerald-500';

/**
 * Self-booking page opened from the link / QR an admin sends for one SO / PO:
 * document summary → vehicle type → free day → free slot → vehicle & receiver
 * details → confirm. After booking it becomes the status page (DO + driver link).
 */
export function BookingClient({ token }: { token: string }) {
  const api = `/api/public/book/${encodeURIComponent(token)}`;
  const [meta, setMeta] = useState<Meta | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('status');
  const [vehicleId, setVehicleId] = useState('');
  const [days, setDays] = useState<Day[] | null>(null);
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [time, setTime] = useState('');
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lineBind = useLiffBind(meta?.line?.liff_id, `${api}/line-link`);

  const loadMeta = useCallback(async (silent = false) => {
    try {
      const res = await fetch(`${api}/meta`, { cache: 'no-store' });
      const j = (await res.json()) as { data?: Meta; error?: string };
      if (!res.ok || !j.data) { if (!silent) setFatal(j.error ?? 'เปิดลิงก์ไม่สำเร็จ'); return null; }
      setMeta(j.data);
      return j.data;
    } catch {
      if (!silent) setFatal('เชื่อมต่อไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
      return null;
    }
  }, [api]);

  useEffect(() => {
    void loadMeta().then((m) => { if (m && m.open && !m.bookings.some((b) => LIVE.has(b.status))) setStep('vehicle'); });
  }, [loadMeta]);

  // Status page refreshes itself so "รอยืนยัน" turns into the DO without a manual reload.
  useEffect(() => {
    if (step !== 'status') return;
    const id = setInterval(() => void loadMeta(true), 20_000);
    return () => clearInterval(id);
  }, [step, loadMeta]);

  const loadDays = useCallback(async (vid: string) => {
    setDays(null);
    setError(null);
    try {
      const res = await fetch(`${api}/days?vehicle_type_id=${vid}`, { cache: 'no-store' });
      const j = (await res.json()) as { data?: Day[]; error?: string };
      if (!res.ok) throw new Error(j.error);
      setDays(j.data ?? []);
    } catch (e) {
      setDays([]);
      setError(e instanceof Error && e.message ? e.message : 'โหลดวันที่ว่างไม่สำเร็จ');
    }
  }, [api]);

  const loadSlots = useCallback(async (vid: string, d: string) => {
    setSlots(null);
    setError(null);
    try {
      const res = await fetch(`${api}/slots?vehicle_type_id=${vid}&date=${d}`, { cache: 'no-store' });
      const j = (await res.json()) as { data?: Slot[]; error?: string };
      if (!res.ok) throw new Error(j.error);
      setSlots(j.data ?? []);
    } catch (e) {
      setSlots([]);
      setError(e instanceof Error && e.message ? e.message : 'โหลดช่วงเวลาไม่สำเร็จ');
    }
  }, [api]);

  const errors = useMemo(() => {
    const e: Partial<Record<keyof Details, string>> = {};
    if (!isPlausiblePlate(details.plate_number)) e.plate_number = 'กรอกทะเบียนรถ เช่น 70-1234 หรือ กข 1234';
    if (!details.receiver_name.trim()) e.receiver_name = 'กรอกชื่อผู้ติดต่อ';
    if (!PHONE.test(details.receiver_phone.trim())) e.receiver_phone = 'กรอกเบอร์โทรที่ติดต่อได้';
    if (details.driver_phone.trim() && !PHONE.test(details.driver_phone.trim())) e.driver_phone = 'เบอร์โทรไม่ถูกต้อง';
    return e;
  }, [details]);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${api}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicle_type_id: vehicleId, booking_date: date, start_time: time, ...details }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      if (!res.ok) {
        setError(j.error ?? 'จองไม่สำเร็จ กรุณาลองใหม่');
        // Someone took the slot while this form was open: go back to a fresh slot list.
        if (j.code === 'slot_unavailable' || j.code === 'slot_past') { setTime(''); setStep('slot'); void loadSlots(vehicleId, date); }
        return;
      }
      await loadMeta(true);
      setStep('status');
      setDetails(EMPTY_DETAILS);
      setTime('');
      window.scrollTo({ top: 0 });
    } finally {
      setBusy(false);
    }
  }

  /** Inside LINE: let the customer pick the driver's chat and drop the job card there. */
  function shareDriver(b: PublicBooking) {
    const liff = lineBind.liff;
    if (!liff?.shareTargetPicker || !b.driver_url || !meta) return;
    const liffDriverUrl = meta.line?.liff_id ? `https://liff.line.me/${meta.line.liff_id}${new URL(b.driver_url).pathname}?via=line` : b.driver_url;
    const text = `งาน${b.direction === 'outbound' ? 'รับสินค้า' : 'ส่งสินค้า'} ${meta.site.name}\nคิว ${b.queue_number} · ${longThaiDate(b.booking_date)} ${b.start_time.slice(0, 5)} น.\nทะเบียน ${b.plate_number ?? '-'}${b.resource_name ? ` · ${b.resource_name}` : ''}${b.do_number ? ` · ${b.do_number}` : ''}\nเปิดลิงก์นี้ใน LINE เพื่อดู DO และรับแจ้งเมื่อถึงคิว:\n${liffDriverUrl}`;
    liff.shareTargetPicker([{ type: 'text', text }]).catch(() => undefined);
  }

  async function cancel(b: PublicBooking) {
    if (busy) return;
    // Tailwind page without the MUI confirm provider — native confirm is deliberate here.
    if (!window.confirm(`ยกเลิกคิว ${b.queue_number} ?\nช่วงเวลานี้จะถูกปล่อยให้ผู้อื่นจอง`)) return;
    setBusy(true);
    try {
      const res = await fetch(`${api}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ booking_id: b.id }) });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setError(j.error ?? 'ยกเลิกไม่สำเร็จ');
      await loadMeta(true);
    } finally {
      setBusy(false);
    }
  }

  if (fatal) {
    return (
      <Shell title="ไม่สามารถเปิดลิงก์ได้">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">{fatal}</div>
      </Shell>
    );
  }
  if (!meta) return <Shell title="กำลังโหลด…"><div className="h-40 animate-pulse rounded-2xl bg-slate-200" /></Shell>;

  const outbound = meta.direction === 'outbound';
  const vehicle = meta.vehicle_types.find((v) => v.id === vehicleId);
  const stepsOrder: Step[] = ['vehicle', 'date', 'slot', 'details', 'confirm'];
  const stepIndex = stepsOrder.indexOf(step);

  return (
    <Shell title={outbound ? 'จองคิวรับสินค้า' : 'จองคิวส่งสินค้า'} subtitle={[meta.site.name, meta.site.branch, meta.site.address].filter(Boolean).join(' · ')}>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm text-slate-500">{outbound ? 'Sales Order' : 'Purchase Order'}</p>
          {meta.document.due_date ? <p className="text-xs text-slate-500">กำหนดส่ง {longThaiDate(meta.document.due_date)}</p> : null}
        </div>
        <p className="text-xl font-bold text-slate-900">{meta.document.doc_no}</p>
        <p className="text-sm text-slate-700">{meta.document.partner_name ?? '-'}</p>
        {meta.document.items.length > 0 ? (
          <details className="mt-2 text-sm text-slate-600">
            <summary className="cursor-pointer select-none py-1 font-medium text-emerald-700">รายการสินค้า {meta.document.items.length} รายการ</summary>
            <ul className="mt-1 space-y-1">
              {meta.document.items.map((it, i) => <li key={i} className="flex justify-between gap-3"><span className="min-w-0 truncate">{it.name}</span><span className="shrink-0 tabular-nums">{Number(it.qty).toLocaleString('th-TH')} {it.uom ?? ''}</span></li>)}
            </ul>
          </details>
        ) : null}
      </section>

      <LineBanner line={meta.line} state={lineBind.state} viaLine={lineBind.viaLine} path={`/book/${encodeURIComponent(token)}`} who="customer" />

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</div> : null}

      {step === 'status' ? (
        <>
          {meta.bookings.length === 0 ? <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-600">ยังไม่มีคิวสำหรับเอกสารนี้</p> : null}
          {meta.bookings.map((b) => (
            <BookingCard key={b.id} b={b} showDriverLink onShareDriver={lineBind.liff?.shareTargetPicker && lineBind.state.phase === 'bound' ? shareDriver : undefined}
              footer={b.cancellable ? <button type="button" disabled={busy} onClick={() => void cancel(b)} className="mt-4 min-h-[44px] w-full rounded-xl border border-red-200 text-sm font-medium text-red-700 active:bg-red-50">ยกเลิกคิวนี้</button> : null} />
          ))}
          {meta.open ? (
            <button type="button" className={meta.bookings.some((b) => LIVE.has(b.status)) ? btnGhost : btnPrimary} onClick={() => { setError(null); setStep('vehicle'); }}>
              {meta.bookings.some((b) => LIVE.has(b.status)) ? 'จองคิวเพิ่ม (รับ/ส่งหลายเที่ยว)' : 'จองคิว'}
            </button>
          ) : <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-600">เอกสารนี้ปิดแล้ว ไม่สามารถจองคิวเพิ่มได้ — ติดต่อเจ้าหน้าที่{meta.site.phone ? ` ${meta.site.phone}` : ''}</p>}
        </>
      ) : (
        <ol className="flex items-center gap-1" aria-label="ขั้นตอน">
          {stepsOrder.map((s, i) => <li key={s} className={`h-1.5 flex-1 rounded-full ${i <= stepIndex ? 'bg-emerald-500' : 'bg-slate-200'}`} />)}
        </ol>
      )}

      {step === 'vehicle' ? (
        <StepCard title="1. รถที่จะมา" hint="ประเภทรถกำหนดเวลาที่ใช้ท่า">
          {meta.vehicle_types.length === 0 ? <p className="text-sm text-slate-600">ยังไม่เปิดให้จอง กรุณาติดต่อเจ้าหน้าที่</p> : null}
          <div className="grid gap-2">
            {meta.vehicle_types.map((v) => (
              <button key={v.id} type="button" onClick={() => { setVehicleId(v.id); setDate(''); setTime(''); setStep('date'); void loadDays(v.id); }}
                className={`flex min-h-[56px] items-center justify-between rounded-xl border px-4 text-left active:bg-emerald-50 ${vehicleId === v.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-white'}`}>
                <span className="font-semibold text-slate-900">{v.service_name}</span>
                <span className="text-sm text-slate-500">ประมาณ {v.duration_minutes} นาที</span>
              </button>
            ))}
          </div>
          {meta.bookings.length > 0 ? <button type="button" className={`${btnGhost} mt-3`} onClick={() => setStep('status')}>กลับไปดูคิวของฉัน</button> : null}
        </StepCard>
      ) : null}

      {step === 'date' ? (
        <StepCard title="2. เลือกวัน" hint={`แสดงเฉพาะวันที่ยังมีคิวว่าง${meta.rules.lead_hours > 0 ? ` · ต้องจองล่วงหน้าอย่างน้อย ${meta.rules.lead_hours} ชม.` : ''}`}>
          {days === null ? <div className="h-24 animate-pulse rounded-xl bg-slate-200" /> : null}
          {days && days.length === 0 ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">ไม่มีวันว่างในช่วง {meta.rules.horizon_days} วันข้างหน้า กรุณาติดต่อเจ้าหน้าที่{meta.site.phone ? ` ${meta.site.phone}` : ''}</p> : null}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {(days ?? []).map((d) => {
              const t = shortThaiDate(d.day);
              return (
                <button key={d.day} type="button" onClick={() => { setDate(d.day); setTime(''); setStep('slot'); void loadSlots(vehicleId, d.day); }}
                  className={`min-h-[72px] rounded-xl border px-2 py-2 text-center active:bg-emerald-50 ${date === d.day ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-white'}`}>
                  <span className="block text-xs text-slate-500">{t.dow}</span>
                  <span className="block text-xl font-bold text-slate-900">{t.day}</span>
                  <span className="block text-xs text-slate-500">{t.month} · ว่าง {d.open_slots}</span>
                </button>
              );
            })}
          </div>
          <button type="button" className={`${btnGhost} mt-3`} onClick={() => setStep('vehicle')}>ย้อนกลับ</button>
        </StepCard>
      ) : null}

      {step === 'slot' ? (
        <StepCard title="3. เลือกเวลา" hint={date ? longThaiDate(date) : ''}>
          {slots === null ? <div className="h-24 animate-pulse rounded-xl bg-slate-200" /> : null}
          {slots && !slots.some((s) => s.bookable) ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">วันนี้เต็มแล้ว กรุณาเลือกวันอื่น</p> : null}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(slots ?? []).map((s) => {
              const t = s.slot_time.slice(0, 5);
              const hint = s.is_past ? 'ผ่านแล้ว' : s.too_soon ? 'จองไม่ทัน' : s.remaining_capacity <= 0 ? 'เต็ม' : `ว่าง ${s.remaining_capacity}`;
              return (
                <button key={s.slot_time} type="button" disabled={!s.bookable} onClick={() => { setTime(t); setStep('details'); }}
                  className={`min-h-[56px] rounded-xl border px-2 text-center disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 ${time === t ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-white active:bg-emerald-50'}`}>
                  <span className="block font-bold">{t}–{s.slot_end.slice(0, 5)}</span>
                  <span className="block text-xs">{hint}</span>
                </button>
              );
            })}
          </div>
          <button type="button" className={`${btnGhost} mt-3`} onClick={() => setStep('date')}>เลือกวันอื่น</button>
        </StepCard>
      ) : null}

      {step === 'details' ? (
        <StepCard title="4. ข้อมูลรถและผู้ติดต่อ" hint="ป้อมยามจะตรวจทะเบียนรถตามข้อมูลนี้">
          <Field label="ทะเบียนรถ *" error={touched ? errors.plate_number : undefined}>
            <input className={inputCls} value={details.plate_number} onChange={(e) => setDetails((p) => ({ ...p, plate_number: e.target.value }))} placeholder="เช่น 70-1234" autoCapitalize="characters" />
          </Field>
          <Field label={outbound ? 'ชื่อผู้รับสินค้า *' : 'ชื่อผู้ติดต่อ *'} error={touched ? errors.receiver_name : undefined}>
            <input className={inputCls} value={details.receiver_name} onChange={(e) => setDetails((p) => ({ ...p, receiver_name: e.target.value }))} autoComplete="name" />
          </Field>
          <Field label="เบอร์โทร *" error={touched ? errors.receiver_phone : undefined}>
            <input className={inputCls} value={details.receiver_phone} onChange={(e) => setDetails((p) => ({ ...p, receiver_phone: e.target.value }))} inputMode="tel" autoComplete="tel" placeholder="0812345678" />
          </Field>
          <Field label="ชื่อคนขับ">
            <input className={inputCls} value={details.driver_name} onChange={(e) => setDetails((p) => ({ ...p, driver_name: e.target.value }))} />
          </Field>
          <Field label="เบอร์คนขับ" error={touched ? errors.driver_phone : undefined}>
            <input className={inputCls} value={details.driver_phone} onChange={(e) => setDetails((p) => ({ ...p, driver_phone: e.target.value }))} inputMode="tel" />
          </Field>
          <Field label="หมายเหตุ">
            <textarea className={inputCls} rows={2} maxLength={500} value={details.note} onChange={(e) => setDetails((p) => ({ ...p, note: e.target.value }))} />
          </Field>
          <div className="mt-2 grid gap-2">
            <button type="button" className={btnPrimary} onClick={() => { setTouched(true); if (Object.keys(errors).length === 0) setStep('confirm'); }}>ถัดไป</button>
            <button type="button" className={btnGhost} onClick={() => setStep('slot')}>ย้อนกลับ</button>
          </div>
        </StepCard>
      ) : null}

      {step === 'confirm' ? (
        <StepCard title="5. ตรวจสอบและยืนยัน">
          <dl className="grid grid-cols-3 gap-y-2 text-sm">
            <dt className="text-slate-500">วันเวลา</dt><dd className="col-span-2 font-semibold text-slate-900">{longThaiDate(date)} · {time} น.</dd>
            <dt className="text-slate-500">ประเภทรถ</dt><dd className="col-span-2 text-slate-900">{vehicle?.service_name}</dd>
            <dt className="text-slate-500">ทะเบียน</dt><dd className="col-span-2 font-semibold text-slate-900">{details.plate_number}</dd>
            <dt className="text-slate-500">{outbound ? 'ผู้รับ' : 'ผู้ติดต่อ'}</dt><dd className="col-span-2 text-slate-900">{details.receiver_name} · {details.receiver_phone}</dd>
            {details.driver_name ? <><dt className="text-slate-500">คนขับ</dt><dd className="col-span-2 text-slate-900">{[details.driver_name, details.driver_phone].filter(Boolean).join(' · ')}</dd></> : null}
          </dl>
          <p className="mt-3 rounded-xl bg-slate-100 p-3 text-xs text-slate-600">
            {meta.rules.require_admin_confirm ? 'เจ้าหน้าที่จะยืนยันคิวและออกเลข DO ให้ — กลับมาดูสถานะได้ที่ลิงก์เดิมนี้' : 'ระบบจะยืนยันคิวและออกเลข DO ให้ทันที'}
            {meta.rules.grace_minutes > 0 ? ` · มาช้าได้ไม่เกิน ${meta.rules.grace_minutes} นาที` : ''}
          </p>
          <div className="mt-3 grid gap-2">
            <button type="button" className={btnPrimary} disabled={busy} onClick={() => void submit()}>{busy ? 'กำลังจอง…' : 'ยืนยันจองคิว'}</button>
            <button type="button" className={btnGhost} disabled={busy} onClick={() => setStep('details')}>แก้ไขข้อมูล</button>
          </div>
        </StepCard>
      ) : null}

      <footer className="pb-6 pt-2 text-center text-xs text-slate-500">
        {meta.site.name}{meta.site.phone ? ` · โทร ${meta.site.phone}` : ''}
      </footer>
    </Shell>
  );
}

function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-5">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
        </header>
        {children}
      </div>
    </main>
  );
}

function StepCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      {hint ? <p className="mb-3 text-sm text-slate-500">{hint}</p> : <div className="mb-3" />}
      {children}
    </section>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block text-sm font-medium text-slate-700">
      {label}
      {children}
      {error ? <span className="mt-1 block text-xs font-normal text-red-600">{error}</span> : null}
    </label>
  );
}
