'use client';

import type { DriverAlertsState } from './use-driver-alerts';

/**
 * Strip on the driver page for phone alerts without LINE: one button to turn
 * them on, then a status line. Hidden once the queue is closed.
 */
export function AlertsBanner({ state, lineBound, onEnable, onDisable }: { state: DriverAlertsState; /** Driver already gets LINE pushes — the strip becomes secondary. */ lineBound: boolean; onEnable: () => void; onDisable: () => void }) {
  if (state.support === 'unsupported') {
    if (!state.iosNeedsInstall) return null;
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        <p className="font-semibold">รับแจ้งเตือนบน iPhone โดยไม่ใช้ LINE</p>
        <p className="mt-1 text-slate-600">กดปุ่มแชร์ของ Safari → “เพิ่มไปยังหน้าจอโฮม” แล้วเปิดหน้านี้จากไอคอนบนหน้าจอ จึงจะเปิดแจ้งเตือนได้</p>
      </div>
    );
  }

  if (state.enabled) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
        <p>🔔 แจ้งเตือนบนมือถือเปิดแล้ว · เสียง + สั่น{state.subscribed ? ' + แจ้งแม้ปิดหน้านี้' : ' (เปิดหน้านี้ค้างไว้)'}</p>
        <button type="button" disabled={state.busy} onClick={onDisable} className="shrink-0 rounded-lg border border-sky-300 px-3 py-1.5 text-xs font-medium text-sky-800 active:bg-sky-100 disabled:opacity-50">ปิด</button>
      </div>
    );
  }

  if (state.permission === 'denied') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        การแจ้งเตือนของเว็บนี้ถูกปิดกั้นไว้ — เปิดสิทธิ์ “การแจ้งเตือน” ของเว็บนี้ในตั้งค่าเบราว์เซอร์ แล้วโหลดหน้านี้ใหม่
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-3 text-sm ${lineBound ? 'border-slate-200 bg-white text-slate-700' : 'border-sky-300 bg-sky-50 text-slate-800'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{lineBound ? 'แจ้งเตือนบนมือถือเพิ่มเติม' : 'รับแจ้งเตือนบนมือถือ (ไม่ต้องใช้ LINE)'}</p>
          <p className="text-xs text-slate-600">เสียง + สั่น เมื่อถึงคิว เลยเวลานัด หรือคิวถูกปิด{state.support === 'push' ? ' · แจ้งแม้ปิดหน้านี้' : ''}</p>
        </div>
        <button type="button" disabled={state.busy} onClick={onEnable} className="shrink-0 rounded-lg bg-sky-600 px-3 py-2 font-semibold text-white active:bg-sky-700 disabled:bg-slate-300">
          {state.busy ? 'กำลังเปิด…' : '🔔 เปิดแจ้งเตือน'}
        </button>
      </div>
      {state.error ? <p className="mt-2 text-xs text-red-700" role="alert">{state.error}</p> : null}
    </div>
  );
}
