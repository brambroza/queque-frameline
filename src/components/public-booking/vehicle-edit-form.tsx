'use client';

import { useMemo, useState } from 'react';
import { PLATE_FORMAT_INFO, formatPlateInput, matchesPlateFormat, toPlateFormat } from '@/lib/booking/plate';
import type { PublicBooking } from './types';

const PHONE = /^[0-9+\-\s()]{8,20}$/;
const inputCls = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 outline-none focus:border-emerald-500';

export type VehicleEditValues = { plate_number: string; driver_name: string; driver_phone: string };

/**
 * Inline form under a queue card: the customer changes the plate and / or the
 * driver before the truck arrives. Validation mirrors the booking form (plate
 * layout of the vehicle type, phone shape); the server is still the authority.
 */
export function VehicleEditForm({ b, busy, onSubmit, onCancel }: { b: PublicBooking; busy: boolean; onSubmit: (values: VehicleEditValues) => Promise<void>; onCancel: () => void }) {
  const plateFormat = toPlateFormat(b.services?.plate_format);
  const [values, setValues] = useState<VehicleEditValues>({
    plate_number: formatPlateInput(b.plate_number ?? '', plateFormat),
    driver_name: b.driver_name ?? '',
    driver_phone: b.driver_phone ?? '',
  });
  const [touched, setTouched] = useState(false);

  const errors = useMemo(() => {
    const e: Partial<Record<keyof VehicleEditValues, string>> = {};
    if (!matchesPlateFormat(values.plate_number, plateFormat)) e.plate_number = `ทะเบียนไม่ตรงรูปแบบ — ${PLATE_FORMAT_INFO[plateFormat].hint}`;
    if (values.driver_phone.trim() && !PHONE.test(values.driver_phone.trim())) e.driver_phone = 'เบอร์โทรไม่ถูกต้อง';
    return e;
  }, [values, plateFormat]);

  return (
    <form
      className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3"
      onSubmit={(e) => { e.preventDefault(); setTouched(true); if (Object.keys(errors).length === 0 && !busy) void onSubmit(values); }}
    >
      <p className="text-sm font-semibold text-slate-900">เปลี่ยนรถ / คนขับ</p>
      <p className="mb-2 text-xs text-slate-600">คลังจะได้รับแจ้งทันที — ป้อมยามจะตรวจทะเบียนตามข้อมูลใหม่นี้</p>
      <Field label={`ทะเบียนรถ${b.services?.service_name ? ` (${b.services.service_name})` : ''} *`} error={touched ? errors.plate_number : undefined}>
        <input className={inputCls} value={values.plate_number} onChange={(e) => setValues((p) => ({ ...p, plate_number: formatPlateInput(e.target.value, plateFormat) }))}
          placeholder={`เช่น ${PLATE_FORMAT_INFO[plateFormat].example}`} inputMode={plateFormat === 'truck' ? 'numeric' : 'text'} maxLength={12} autoComplete="off" autoCorrect="off" spellCheck={false} />
        <span className="mt-1 block text-xs font-normal text-slate-500">{PLATE_FORMAT_INFO[plateFormat].hint}</span>
      </Field>
      <Field label="ชื่อคนขับ">
        <input className={inputCls} value={values.driver_name} maxLength={120} onChange={(e) => setValues((p) => ({ ...p, driver_name: e.target.value }))} />
      </Field>
      <Field label="เบอร์คนขับ" error={touched ? errors.driver_phone : undefined}>
        <input className={inputCls} value={values.driver_phone} onChange={(e) => setValues((p) => ({ ...p, driver_phone: e.target.value }))} inputMode="tel" autoComplete="tel" placeholder="0812345678" />
      </Field>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} onClick={onCancel} className="min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-700 active:bg-slate-100">ยกเลิก</button>
        <button type="submit" disabled={busy} className="min-h-[44px] rounded-xl bg-emerald-600 text-sm font-semibold text-white active:bg-emerald-700 disabled:bg-slate-300">{busy ? 'กำลังบันทึก…' : 'บันทึกและแจ้งคลัง'}</button>
      </div>
    </form>
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
