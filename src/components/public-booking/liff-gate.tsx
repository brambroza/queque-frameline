'use client';

import { useEffect, useState } from 'react';

/**
 * LIFF entry. A LIFF URL with a path (`liff.line.me/{id}/book/…`) first opens
 * the endpoint URL (this site's root) with `?liff.state=/book/…`; the SDK must
 * run here so it can redirect to that path. Nothing else happens on this page.
 */
export function LiffGate({ liffId }: { liffId: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const s = document.createElement('script');
    s.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
    s.async = true;
    s.onload = () => {
      window.liff?.init({ liffId, withLoginOnExternalBrowser: true }).catch(() => setFailed(true));
    };
    s.onerror = () => setFailed(true);
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, [liffId]);
  return (
    <main className="min-h-screen grid place-items-center bg-slate-50 p-6 text-center text-slate-600">
      {failed ? <p>เปิดผ่าน LINE ไม่สำเร็จ กรุณาเปิดลิงก์เว็บที่ได้รับแทน</p> : <p>กำลังเปิดจาก LINE…</p>}
    </main>
  );
}
