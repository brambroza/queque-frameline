'use client';

import type { LiffBindState } from './use-liff-bind';

export type LineMeta = { liff_id: string | null; add_friend_url: string | null; linked_name: string | null; enabled: boolean };

/**
 * Strip under the page header that tells the visitor where LINE notifications
 * stand: bound (with add-friend nudge when the OA is not yet a friend), still
 * binding, or — on a plain web visit — a button to open this page inside LINE.
 */
export function LineBanner({ line, state, viaLine, path, who }: { line: LineMeta | undefined; state: LiffBindState; viaLine: boolean; path: string; who: 'customer' | 'driver' }) {
  if (!line?.enabled || !line.liff_id) return null;
  const liffHref = `https://liff.line.me/${line.liff_id}${path}?via=line`;

  if (state.phase === 'bound') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
        <p>✅ รับแจ้งเตือนทาง LINE แล้ว{state.displayName ? ` (${state.displayName})` : ''}</p>
        {state.isFriend === false && line.add_friend_url ? (
          <a href={line.add_friend_url} className="mt-2 inline-block rounded-lg bg-emerald-600 px-3 py-2 font-medium text-white">เพิ่มเพื่อน OA เพื่อรับข้อความ</a>
        ) : null}
      </div>
    );
  }
  if (state.phase === 'binding') return <div className="rounded-xl bg-slate-100 p-3 text-sm text-slate-600">กำลังเชื่อมต่อ LINE…</div>;
  if (state.phase === 'error' && viaLine) {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">เชื่อมต่อ LINE ไม่สำเร็จ ยังใช้หน้านี้ได้ตามปกติ แต่จะไม่มีแจ้งเตือนทาง LINE</div>;
  }
  if (line.linked_name && !viaLine) {
    return <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">✅ {who === 'driver' ? 'คนขับ' : 'บัญชีนี้'}รับแจ้งเตือนทาง LINE แล้ว ({line.linked_name})</div>;
  }
  if (!viaLine) {
    return (
      <a href={liffHref} className="flex items-center justify-between rounded-xl border border-[#06C755] bg-white p-3 text-sm text-slate-800 active:bg-emerald-50">
        <span>รับแจ้งเตือน{who === 'driver' ? 'เมื่อถึงคิว' : 'สถานะคิว'}ทาง LINE</span>
        <span className="rounded-lg bg-[#06C755] px-3 py-1.5 font-semibold text-white">เปิดใน LINE</span>
      </a>
    );
  }
  return null;
}
