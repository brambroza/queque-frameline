'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { docLabel, hhmm } from '@/lib/display/format';
import { YardScene } from './yard-scene';

type Item = {
  id: string; queue_number: string; status: string; direction: 'inbound' | 'outbound'; start_time: string; plate: string; do_number: string | null;
  called_at: string | null; call_count: number | null; dock_id: string | null;
  service_name: string | null; doc_no: string | null; doc_type: 'so' | 'po' | null; customer_name: string | null; driver_name: string | null;
};
type DockView = { id: string; code: string | null; name: string; direction: 'inbound' | 'outbound' | null; current: Item | null };
type Feed = { site: { name: string; logo_url?: string | null }; docks: DockView[]; waiting: Item[]; server_time: string };

const POLL_MS = 5000;

/** Reads a plate so Thai TTS pronounces it: letters spaced, digits one by one. */
function speakablePlate(plate: string): string {
  return plate.replace(/[\s\-]+/g, '').split('').join(' ');
}

/** Empty / missing value on the TV. */
const dash = (v: string | null | undefined): string => (v && v.trim() ? v : '-');

/** Label + value pair inside a dock tile. */
function Meta({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`min-w-0 ${wide ? 'col-span-2' : ''}`}>
      <dt className="text-[11px] uppercase tracking-wider text-fameline-mint-soft/60">{label}</dt>
      <dd className="truncate text-base font-semibold" title={value}>{value}</dd>
    </div>
  );
}

/** Site logo on the TV: the uploaded logo when there is one, else the Fameline "F" mark + wordmark. */
function Brand({ name, logoUrl }: { name: string; logoUrl: string | null | undefined }) {
  return (
    <div className="flex items-center gap-3">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- external URL from site settings, no fixed size
        <img src={logoUrl} alt={name} className="h-12 w-auto max-w-[220px] object-contain" />
      ) : (
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-fameline-mint text-3xl font-extrabold leading-none text-fameline-green">F</span>
      )}
      <div className="leading-tight">
        <div className="text-2xl font-extrabold tracking-[0.18em] text-fameline-mint">FAMELINE</div>
        <div className="text-sm text-fameline-mint-soft/70">{name}</div>
      </div>
    </div>
  );
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
    <main className="flex h-screen flex-col overflow-hidden bg-gradient-to-b from-fameline-green to-fameline-green-deep p-6 text-white" onClick={() => setSound(true)}>
      <header className="mb-5 flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-5">
          <Brand name={feed?.site.name ?? 'Fameline'} logoUrl={feed?.site.logo_url} />
          <span className="h-10 w-px bg-white/20" aria-hidden />
          <h1 className="text-3xl font-bold">คิวรับ-ส่งสินค้า</h1>
        </div>
        <div className="flex items-center gap-4">
          {offline ? <span className="rounded-full bg-red-600 px-3 py-1 text-sm">ขาดการเชื่อมต่อ — กำลังลองใหม่</span> : null}
          {!sound ? <span className="rounded-full bg-fameline-lime px-3 py-1 text-sm font-semibold text-fameline-green">แตะหน้าจอเพื่อเปิดเสียงเรียกคิว</span> : null}
          <span className="text-4xl font-bold tabular-nums">{clock}</span>
        </div>
      </header>

      {!feed ? (
        <p className="text-xl text-fameline-mint-soft/70">กำลังโหลด…</p>
      ) : feed.docks.length === 0 ? (
        <p className="text-xl text-fameline-mint-soft/70">ยังไม่ได้ตั้งค่าท่า</p>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[11fr_9fr] gap-6">
          {/* left: 2D yard, live from the same feed */}
          <section className="min-h-0 rounded-2xl border border-white/10 bg-white/5 p-3" aria-label="ผังลาน">
            <YardScene docks={feed.docks} waiting={feed.waiting} siteName={feed.site.name} />
          </section>

          {/* right: per-dock detail + waiting line */}
          <div className="flex min-h-0 flex-col gap-4">
            <section className={`grid shrink-0 gap-4 ${feed.docks.length > 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {feed.docks.map((d) => {
                const c = d.current;
                const calling = c?.status === 'called';
                return (
                  <article key={d.id} className={`rounded-2xl border-4 p-5 ${calling ? 'animate-pulse border-fameline-lime bg-fameline-lime/10' : c ? 'border-fameline-mint bg-fameline-mint/10' : 'border-white/15 bg-white/5'}`}>
                    <div className="flex items-baseline justify-between">
                      <h2 className="text-2xl font-bold">{d.name}</h2>
                      <span className="text-sm text-fameline-mint-soft/70">{d.direction === 'outbound' ? 'รับสินค้า' : d.direction === 'inbound' ? 'ส่งสินค้า' : 'รับ / ส่ง'}</span>
                    </div>
                    {c ? (
                      <>
                        <p className={`mt-3 text-sm font-semibold uppercase tracking-wide ${calling ? 'text-fameline-lime' : 'text-fameline-mint-soft'}`}>{calling ? 'เชิญเข้าท่า' : 'กำลังขึ้น/ลงของ'}</p>
                        <p className="text-6xl font-extrabold leading-tight">{c.queue_number}</p>
                        <p className="mt-1 text-4xl font-bold text-fameline-mint">{c.plate || '-'}</p>
                        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-white/15 pt-2.5">
                          <Meta label="ประเภทรถ" value={dash(c.service_name)} />
                          <Meta label="เวลานัด" value={dash(hhmm(c.start_time))} />
                          <Meta label={c.doc_type === 'po' ? 'PO' : 'SO'} value={dash(docLabel(c.doc_type, c.doc_no))} />
                          <Meta label="คนขับ" value={dash(c.driver_name)} />
                          <Meta label={c.direction === 'inbound' ? 'ผู้ส่ง' : 'ลูกค้า'} value={dash(c.customer_name)} wide />
                        </dl>
                        <p className="mt-2 text-sm text-fameline-mint-soft/60">{c.do_number ?? ''}</p>
                      </>
                    ) : (
                      <p className="mt-6 text-3xl font-semibold text-fameline-mint-soft/40">ว่าง</p>
                    )}
                  </article>
                );
              })}
            </section>

            <section className="min-h-0 flex-1 overflow-hidden">
              <h2 className="mb-3 text-xl font-semibold text-fameline-mint-soft">มาถึงแล้ว · รอเรียก ({feed.waiting.length})</h2>
              <div className="flex flex-wrap gap-3">
                {feed.waiting.slice(0, 24).map((w) => (
                  <div key={w.id} className="min-w-0 rounded-xl border border-white/10 bg-white/10 px-4 py-2">
                    <div className="flex items-baseline gap-3">
                      <span className="text-2xl font-bold">{w.queue_number}</span>
                      <span className="text-xl text-fameline-mint">{w.plate || '-'}</span>
                      <span className="text-sm text-fameline-mint-soft/70">{hhmm(w.start_time)}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-2 text-[13px] text-fameline-mint-soft/70">
                      <span>{dash(w.service_name)}</span>
                      <span className="text-white/30">·</span>
                      <span className="font-semibold text-fameline-mint-soft">{dash(docLabel(w.doc_type, w.doc_no))}</span>
                      <span className="text-white/30">·</span>
                      <span>{dash(w.customer_name)}</span>
                      <span className="text-white/30">·</span>
                      <span>{dash(w.driver_name)}</span>
                    </div>
                  </div>
                ))}
                {feed.waiting.length === 0 ? <p className="text-fameline-mint-soft/50">ไม่มีรถรอเรียก</p> : null}
              </div>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
