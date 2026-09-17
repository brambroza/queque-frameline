'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Item = { id: string; queue_number: string; status: string; direction: 'inbound' | 'outbound'; start_time: string; plate: string; do_number: string | null; called_at: string | null; call_count: number | null; dock_id: string | null };
type DockView = { id: string; code: string | null; name: string; direction: 'inbound' | 'outbound' | null; current: Item | null };
type Feed = { site: { name: string }; docks: DockView[]; waiting: Item[]; server_time: string };

const POLL_MS = 5000;

/** Reads a plate so Thai TTS pronounces it: letters spaced, digits one by one. */
function speakablePlate(plate: string): string {
  return plate.split('').join(' ');
}

/**
 * Yard TV: one tile per dock, the waiting line below. Polls every 5 s and
 * announces each new call (Thai speech synthesis, after the screen was tapped
 * once — browsers block audio until a user gesture).
 */
export function DockDisplay({ displayKey }: { displayKey: string }) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [offline, setOffline] = useState(false);
  const [sound, setSound] = useState(false);
  const [clock, setClock] = useState('');
  const announced = useRef<Map<string, string>>(new Map());
  const primed = useRef(false);

  const announce = useCallback((item: Item, dockName: string) => {
    if (!sound || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const text = `ขอเชิญคิว ${item.queue_number.replace('-', ' ')} ทะเบียน ${speakablePlate(item.plate)} เข้า${dockName}`;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'th-TH';
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }, [sound]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/display${displayKey ? `?key=${encodeURIComponent(displayKey)}` : ''}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const j = (await res.json()) as { data: Feed };
      setFeed(j.data);
      setOffline(false);
      // Announce a call once per (booking, called_at); a repeat call changes called_at and is announced again.
      for (const d of j.data.docks) {
        const c = d.current;
        if (!c || c.status !== 'called') continue;
        const stamp = c.called_at ?? '';
        if (announced.current.get(c.id) === stamp) continue;
        announced.current.set(c.id, stamp);
        if (primed.current) announce(c, d.name); // first load: do not read out calls that are already on screen
      }
      primed.current = true;
    } catch {
      setOffline(true);
    }
  }, [displayKey, announce]);

  useEffect(() => { void load(); const id = setInterval(() => void load(), POLL_MS); return () => clearInterval(id); }, [load]);
  useEffect(() => {
    const tick = () => setClock(new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()));
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white" onClick={() => setSound(true)}>
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">{feed?.site.name ?? 'Fameline'} · คิวรับ-ส่งสินค้า</h1>
        <div className="flex items-center gap-4">
          {offline ? <span className="rounded-full bg-red-600 px-3 py-1 text-sm">ขาดการเชื่อมต่อ — กำลังลองใหม่</span> : null}
          {!sound ? <span className="rounded-full bg-amber-500 px-3 py-1 text-sm text-black">แตะหน้าจอเพื่อเปิดเสียงเรียกคิว</span> : null}
          <span className="text-4xl font-bold tabular-nums">{clock}</span>
        </div>
      </header>

      {!feed ? (
        <p className="text-xl text-slate-400">กำลังโหลด…</p>
      ) : feed.docks.length === 0 ? (
        <p className="text-xl text-slate-400">ยังไม่ได้ตั้งค่าท่า</p>
      ) : (
        <section className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(feed.docks.length, 4)}, minmax(0, 1fr))` }}>
          {feed.docks.map((d) => {
            const c = d.current;
            const calling = c?.status === 'called';
            return (
              <article key={d.id} className={`rounded-2xl border-4 p-5 ${calling ? 'animate-pulse border-amber-400 bg-amber-500/10' : c ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 bg-slate-900'}`}>
                <div className="flex items-baseline justify-between">
                  <h2 className="text-2xl font-bold">{d.name}</h2>
                  <span className="text-sm text-slate-400">{d.direction === 'outbound' ? 'รับสินค้า' : d.direction === 'inbound' ? 'ส่งสินค้า' : 'รับ / ส่ง'}</span>
                </div>
                {c ? (
                  <>
                    <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-slate-300">{calling ? 'เชิญเข้าท่า' : 'กำลังขึ้น/ลงของ'}</p>
                    <p className="text-6xl font-extrabold leading-tight">{c.queue_number}</p>
                    <p className="mt-1 text-4xl font-bold text-amber-300">{c.plate || '-'}</p>
                    <p className="mt-2 text-sm text-slate-400">{c.do_number ?? ''}</p>
                  </>
                ) : (
                  <p className="mt-8 text-3xl font-semibold text-slate-500">ว่าง</p>
                )}
              </article>
            );
          })}
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-semibold text-slate-300">มาถึงแล้ว · รอเรียก ({feed?.waiting.length ?? 0})</h2>
        <div className="flex flex-wrap gap-3">
          {(feed?.waiting ?? []).slice(0, 24).map((w) => (
            <div key={w.id} className="rounded-xl bg-slate-800 px-4 py-2">
              <span className="text-2xl font-bold">{w.queue_number}</span>
              <span className="ml-3 text-xl text-amber-300">{w.plate || '-'}</span>
              <span className="ml-3 text-sm text-slate-400">{String(w.start_time).slice(0, 5)}</span>
            </div>
          ))}
          {feed && feed.waiting.length === 0 ? <p className="text-slate-500">ไม่มีรถรอเรียก</p> : null}
        </div>
      </section>
    </main>
  );
}
