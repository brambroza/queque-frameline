'use client';

import { QrCode } from '@/components/ui/qr-code';
import { PUBLIC_STATUS, longThaiDate, type PublicBooking } from './types';

/** One queue as the customer / driver sees it: status, time, dock, plate, DO. */
export function BookingCard({ b, showDriverLink, footer, onShareDriver }: { b: PublicBooking; showDriverLink?: boolean; footer?: React.ReactNode; /** Present when inside LINE: forwards the driver card with the share picker. */ onShareDriver?: (b: PublicBooking) => void }) {
  const st = PUBLIC_STATUS[b.status] ?? { label: b.status, tone: 'bg-slate-200 text-slate-700', hint: '' };
  const plate = b.plate_number_actual || b.plate_number || '-';
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">เลขคิว</p>
          <p className="text-4xl font-extrabold leading-none tracking-tight text-slate-900">{b.queue_number}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${st.tone}`}>{st.label}</span>
      </div>
      {st.hint ? <p className="mt-2 text-sm text-slate-600">{st.hint}</p> : null}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div className="col-span-2"><dt className="text-xs text-slate-500">วันเวลานัด</dt><dd className="font-semibold text-slate-900">{longThaiDate(b.booking_date)} · {b.start_time.slice(0, 5)}{b.end_time ? `–${b.end_time.slice(0, 5)}` : ''} น.</dd></div>
        <div><dt className="text-xs text-slate-500">ท่า</dt><dd className={`font-semibold ${b.status === 'called' ? 'text-2xl text-sky-700' : 'text-slate-900'}`}>{b.resource_name ?? 'แจ้งเมื่อมาถึง'}</dd></div>
        <div><dt className="text-xs text-slate-500">ทะเบียนรถ</dt><dd className="font-semibold text-slate-900">{plate}</dd></div>
        <div><dt className="text-xs text-slate-500">ประเภทรถ</dt><dd className="text-slate-900">{b.services?.service_name ?? '-'}</dd></div>
        <div><dt className="text-xs text-slate-500">เลข DO</dt><dd className="font-semibold text-slate-900">{b.do_number ?? 'รอยืนยัน'}</dd></div>
        {b.driver_name || b.driver_phone ? <div className="col-span-2"><dt className="text-xs text-slate-500">คนขับ</dt><dd className="text-slate-900">{[b.driver_name, b.driver_phone].filter(Boolean).join(' · ')}</dd></div> : null}
      </dl>

      {showDriverLink && b.driver_url ? (
        <div className="mt-4 flex items-center gap-4 rounded-xl bg-slate-50 p-3">
          <QrCode value={b.driver_url} size={96} alt="ลิงก์สำหรับคนขับ" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-slate-900">ส่งให้คนขับ</p>
            <p className="text-slate-600">คนขับสแกนหรือเปิดลิงก์เพื่อดู DO และท่าที่ต้องเข้า</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {onShareDriver ? (
                <button type="button" className="min-h-[40px] rounded-lg bg-[#06C755] px-3 text-sm font-semibold text-white active:opacity-90" onClick={() => onShareDriver(b)}>ส่งให้คนขับทาง LINE</button>
              ) : null}
              <button
                type="button"
                className="min-h-[40px] rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 active:bg-slate-100"
                onClick={() => { void navigator.clipboard?.writeText(b.driver_url ?? ''); }}
              >
                คัดลอกลิงก์คนขับ
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {footer}
    </article>
  );
}
