import { sceneLayout, type YardDockInput, type YardTruck, type YardTruckInput } from '@/lib/display/yard';

/** Scene units; the SVG scales to its box with the aspect ratio kept. */
const W = 1000;
const H = 880;
const ROOF_Y = 28;
const WALL_Y = 72;
const DOOR_Y = 120;
const APRON_Y = 232;
const YARD_Y = 254;
const LANE_Y = 672;

const C = {
  green: '#002c1f',
  deep: '#00170f',
  wall: '#06412f',
  roof: '#0b5942',
  apron: '#12503b',
  yard: '#03271c',
  line: '#2c6b52',
  mint: '#aedbc0',
  mintSoft: '#d4eddf',
  lime: '#adc32b',
  ink: '#0a1a14',
  muted: '#7fb89a',
};

type Tone = 'calling' | 'serving' | 'waiting';

/** Overall width of each truck kind in scene units (before scaling). */
const TRUCK_WIDTH: Record<YardTruck['kind'], number> = { trailer: 48, ten: 48, six: 44, four: 38 };
const CAB_H = 28;

/** Fills for one truck at a given tone. */
function palette(tone: Tone) {
  return {
    body: tone === 'calling' ? C.lime : tone === 'serving' ? C.mintSoft : C.muted,
    bodyDark: tone === 'calling' ? '#8ea622' : tone === 'serving' ? '#9fc9b0' : '#5f9a7d',
    cab: tone === 'waiting' ? '#5f9a7d' : C.mint,
    cabRoof: tone === 'waiting' ? '#79b193' : '#c8e8d5',
    glass: '#0d2a20',
  };
}

/** One axle: a wheel on each side; `dual` draws twin tyres (6/10-wheel rear axles). */
function Axle({ y, w, dual = false }: { y: number; w: number; dual?: boolean }) {
  const tw = dual ? 10 : 6;
  return (
    <>
      <rect x={-w / 2 - tw + 1} y={y} width={tw} height={14} rx={2} fill={C.ink} />
      <rect x={w / 2 - 1} y={y} width={tw} height={14} rx={2} fill={C.ink} />
      {dual ? (
        <>
          <line x1={-w / 2 - tw / 2 + 1} x2={-w / 2 - tw / 2 + 1} y1={y + 1} y2={y + 13} stroke={C.muted} strokeWidth={1} opacity={0.5} />
          <line x1={w / 2 + tw / 2 - 1} x2={w / 2 + tw / 2 - 1} y1={y + 1} y2={y + 13} stroke={C.muted} strokeWidth={1} opacity={0.5} />
        </>
      ) : null}
    </>
  );
}

/** Driver cab seen from above: roof panel, windscreen at the front (bottom), mirrors, headlights. */
function Cab({ y, w, tone, sleeper = false }: { y: number; w: number; tone: Tone; sleeper?: boolean }) {
  const p = palette(tone);
  const h = CAB_H + (sleeper ? 8 : 0);
  const cw = w - 6;
  return (
    <>
      <rect x={-cw / 2} y={y} width={cw} height={h} rx={7} fill={p.cab} stroke={C.green} strokeWidth={2} />
      <rect x={-cw / 2 + 5} y={y + 4} width={cw - 10} height={h - 16} rx={4} fill={p.cabRoof} opacity={0.9} />
      <rect x={-cw / 2 + 4} y={y + h - 11} width={cw - 8} height={7} rx={2} fill={p.glass} opacity={0.85} />
      <rect x={-cw / 2 - 5} y={y + h - 13} width={5} height={3} rx={1} fill={C.ink} />
      <rect x={cw / 2} y={y + h - 13} width={5} height={3} rx={1} fill={C.ink} />
      <rect x={-cw / 2 + 3} y={y + h - 2} width={6} height={3} rx={1} fill="#fff3b0" />
      <rect x={cw / 2 - 9} y={y + h - 2} width={6} height={3} rx={1} fill="#fff3b0" />
    </>
  );
}

/** Tail lights on the rear edge (top) of a body. */
function TailLights({ w }: { w: number }) {
  return (
    <>
      <rect x={-w / 2 + 3} y={-1} width={7} height={3} rx={1} fill="#e5484d" />
      <rect x={w / 2 - 10} y={-1} width={7} height={3} rx={1} fill="#e5484d" />
    </>
  );
}

/** Closed box body with roof ribs and a rear-door seam. */
function BoxBody({ w, length, tone }: { w: number; length: number; tone: Tone }) {
  const p = palette(tone);
  return (
    <>
      <rect x={-w / 2} y={0} width={w} height={length} rx={4} fill={p.body} stroke={C.green} strokeWidth={2} />
      <rect x={-w / 2 + 4} y={4} width={w - 8} height={length - 8} rx={3} fill="none" stroke={C.green} strokeWidth={1} opacity={0.3} />
      {Array.from({ length: Math.floor((length - 16) / 16) }, (_, i) => (
        <line key={i} x1={-w / 2 + 8} x2={w / 2 - 8} y1={16 + i * 16} y2={16 + i * 16} stroke={C.green} strokeWidth={1} opacity={0.35} />
      ))}
      <line x1={0} y1={2} x2={0} y2={12} stroke={C.green} strokeWidth={2} opacity={0.6} />
      <TailLights w={w} />
    </>
  );
}

/** Rear bumper to front bumper, in unscaled scene units. */
function truckTotalLength(t: YardTruck): number {
  return t.length + 4 + CAB_H + (t.kind === 'trailer' ? 68 : t.kind === 'ten' ? 8 : 0);
}

/**
 * Top-down truck, rear end at (0,0), cab pointing down (backed into the door);
 * scaled by the caller. Each vehicle type has its own silhouette:
 * 4-wheel pickup (open bed, 2 axles) · 6-wheel (box, rear twin axle) ·
 * 10-wheel (long box, rear tandem twins) · trailer (semi + tractor, 5 axles).
 */
function Truck({ t, x, y, scale, tone }: { t: YardTruck; x: number; y: number; scale: number; tone: Tone }) {
  const w = TRUCK_WIDTH[t.kind];
  const L = t.length;
  const p = palette(tone);
  const total = truckTotalLength(t);
  let parts: React.ReactNode;
  if (t.kind === 'four') {
    parts = (
      <>
        <Axle y={L - 18} w={w} />
        <Axle y={L + 12} w={w} />
        <rect x={-w / 2} y={0} width={w} height={L} rx={4} fill={p.body} stroke={C.green} strokeWidth={2} />
        {/* open bed */}
        <rect x={-w / 2 + 5} y={5} width={w - 10} height={L - 10} rx={2} fill={p.bodyDark} />
        <line x1={-w / 2 + 5} x2={w / 2 - 5} y1={L / 2} y2={L / 2} stroke={C.green} strokeWidth={1} opacity={0.4} />
        <line x1={0} x2={0} y1={5} y2={L - 5} stroke={C.green} strokeWidth={1} opacity={0.4} />
        <TailLights w={w} />
        <Cab y={L + 3} w={w} tone={tone} />
      </>
    );
  } else if (t.kind === 'six') {
    parts = (
      <>
        <Axle y={L - 22} w={w} dual />
        <Axle y={L + 12} w={w} />
        <BoxBody w={w} length={L} tone={tone} />
        <Cab y={L + 4} w={w} tone={tone} />
      </>
    );
  } else if (t.kind === 'ten') {
    parts = (
      <>
        <Axle y={L - 40} w={w} dual />
        <Axle y={L - 22} w={w} dual />
        <Axle y={L + 12} w={w} />
        <BoxBody w={w} length={L} tone={tone} />
        <Cab y={L + 4} w={w} tone={tone} sleeper />
      </>
    );
  } else {
    // semi-trailer: trailer box, landing gap with kingpin, tractor with drive tandem and a sleeper cab
    const tractorY = L + 6;
    parts = (
      <>
        <Axle y={L - 44} w={w} dual />
        <Axle y={L - 26} w={w} dual />
        <Axle y={tractorY + 6} w={w} dual />
        <Axle y={tractorY + 22} w={w} dual />
        <Axle y={tractorY + 54} w={w} />
        <BoxBody w={w} length={L} tone={tone} />
        {/* chassis under the trailer nose + fifth wheel */}
        <rect x={-w / 2 + 8} y={tractorY - 2} width={w - 16} height={44} rx={3} fill={C.ink} />
        <circle cx={0} cy={tractorY + 10} r={5} fill={p.bodyDark} stroke={C.green} strokeWidth={1.5} />
        <Cab y={tractorY + 40} w={w} tone={tone} sleeper />
      </>
    );
  }
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} className={tone === 'calling' ? 'animate-pulse' : undefined}>
      <rect x={-w / 2 + 5} y={5} width={w} height={total} rx={5} fill="#000" opacity={0.28} />
      {parts}
    </g>
  );
}

/** Rounded label box with up to three lines; anchored at its top-left. */
function Badge({ x, y, width, lines, tone }: { x: number; y: number; width: number; lines: Array<{ text: string; size: number; weight?: number; fill?: string }>; tone: 'calling' | 'serving' | 'waiting' }) {
  const pad = 10;
  const heights = lines.map((l) => l.size * 1.25);
  const height = heights.reduce((a, b) => a + b, 0) + pad * 2 - 4;
  const fill = tone === 'calling' ? C.lime : tone === 'serving' ? C.mint : 'rgba(255,255,255,0.08)';
  const ink = tone === 'waiting' ? '#ffffff' : C.green;
  let cy = y + pad;
  return (
    <g className={tone === 'calling' ? 'animate-pulse' : undefined}>
      <rect x={x} y={y} width={width} height={height} rx={10} fill={fill} stroke={tone === 'waiting' ? 'rgba(255,255,255,0.18)' : 'none'} />
      {lines.map((l, i) => {
        cy += heights[i];
        return (
          <text key={i} x={x + pad} y={cy - l.size * 0.3} fontSize={l.size} fontWeight={l.weight ?? 500} fill={l.fill ?? ink}>
            {l.text}
          </text>
        );
      })}
    </g>
  );
}

/**
 * Bird's-eye yard: the warehouse along the top with one door per dock, the
 * truck being called / served backed into its door, and the checked-in trucks
 * lined up in the lane below in call order. Pure presentation — all data comes
 * from the display feed.
 */
export function YardScene({ docks, waiting, siteName }: { docks: YardDockInput[]; waiting: YardTruckInput[]; siteName: string }) {
  const layout = sceneLayout(docks, waiting, W);
  const n = Math.max(layout.docks.length, 1);
  const slot = W / n;
  const dockScale = Math.min(1.5, Math.max(1, slot / 300));
  const laneSlot = W / Math.max(layout.waiting.length + (layout.overflow ? 1 : 0), 1);
  const laneScale = 0.68;

  return (
    <svg data-yard viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="ผังลานและท่ารับ-ส่งสินค้า">
      {/* building */}
      <polygon points={`0,${WALL_Y} 40,${ROOF_Y} ${W - 40},${ROOF_Y} ${W},${WALL_Y}`} fill={C.roof} />
      <rect x={0} y={WALL_Y} width={W} height={APRON_Y - WALL_Y} fill={C.wall} />
      <text x={W / 2} y={ROOF_Y + 30} textAnchor="middle" fontSize={20} fontWeight={700} fill={C.mint} letterSpacing={3}>
        {siteName.toUpperCase()}
      </text>
      <rect x={0} y={APRON_Y} width={W} height={YARD_Y - APRON_Y} fill={C.apron} />
      <rect x={0} y={YARD_Y} width={W} height={H - YARD_Y} fill={C.yard} />

      {/* docks */}
      {layout.docks.map((d) => {
        const cx = d.x + d.width / 2;
        const doorW = Math.min(d.width * 0.6, 52 * dockScale + 60);
        const active = d.state !== 'idle';
        const doorFill = d.state === 'calling' ? C.lime : d.state === 'serving' ? C.mint : C.deep;
        const truck = d.truck;
        const badgeW = 168;
        // wide slot: label beside the truck; narrow slot (3–4 docks): label under the truck so it never covers it
        const beside = d.width >= 420;
        const truckHalfW = truck ? (TRUCK_WIDTH[truck.kind] / 2) * dockScale : 0;
        const badgeX = beside ? Math.min(cx + truckHalfW + 14, d.x + d.width - badgeW - 6) : Math.max(d.x + 6, Math.min(cx - badgeW / 2, d.x + d.width - badgeW - 6));
        const badgeY = beside || !truck ? YARD_Y + 18 : YARD_Y + 2 + truckTotalLength(truck) * dockScale + 16;
        return (
          <g key={d.id}>
            <text x={cx} y={DOOR_Y - 14} textAnchor="middle" fontSize={26} fontWeight={700} fill="#ffffff">{d.name}</text>
            <text x={cx} y={DOOR_Y + 10} textAnchor="middle" fontSize={15} fill={C.mintSoft} opacity={0.85}>{d.direction}</text>
            <rect x={cx - doorW / 2} y={DOOR_Y + 22} width={doorW} height={APRON_Y - DOOR_Y - 22} rx={6} fill={doorFill} opacity={active ? 0.9 : 1} stroke={active ? doorFill : C.line} strokeWidth={3} className={d.state === 'calling' ? 'animate-pulse' : undefined} />
            {!active ? Array.from({ length: 4 }, (_, i) => <line key={i} x1={cx - doorW / 2 + 8} x2={cx + doorW / 2 - 8} y1={DOOR_Y + 40 + i * 20} y2={DOOR_Y + 40 + i * 20} stroke={C.line} strokeWidth={2} opacity={0.6} />) : null}
            {!active ? <text x={cx} y={APRON_Y - 22} textAnchor="middle" fontSize={20} fontWeight={600} fill={C.mintSoft} opacity={0.5}>ว่าง</text> : null}
            {/* bumper / dock leveler */}
            <rect x={cx - doorW / 2 - 6} y={APRON_Y - 4} width={doorW + 12} height={8} rx={2} fill={C.lime} opacity={active ? 0.9 : 0.35} />
            {truck ? (
              <>
                <Truck t={truck} x={cx} y={YARD_Y + 2} scale={dockScale} tone={d.state === 'calling' ? 'calling' : 'serving'} />
                <Badge
                  x={badgeX}
                  y={badgeY}
                  width={badgeW}
                  tone={d.state === 'calling' ? 'calling' : 'serving'}
                  lines={[
                    { text: truck.queue, size: 34, weight: 800 },
                    { text: truck.plate, size: 24, weight: 700 },
                    { text: d.state === 'calling' ? 'เชิญเข้าท่า' : 'กำลังขึ้น/ลงของ', size: 15 },
                  ]}
                />
              </>
            ) : null}
          </g>
        );
      })}

      {/* yard markings: faint chevrons pointing at the doors, bay stripes in the lane */}
      {layout.docks.map((d) => {
        const cx = d.x + d.width / 2;
        return Array.from({ length: 3 }, (_, i) => {
          const y = LANE_Y - 44 - i * 40;
          return <polyline key={`${d.id}-${i}`} points={`${cx - 22},${y + 14} ${cx},${y} ${cx + 22},${y + 14}`} fill="none" stroke={C.mint} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" opacity={0.12 + i * 0.05} />;
        });
      })}
      {Array.from({ length: Math.max(layout.waiting.length + (layout.overflow ? 1 : 0), 1) + 1 }, (_, i) => (
        <line key={i} x1={i * laneSlot + 8} x2={i * laneSlot + 8} y1={LANE_Y + 36} y2={H - 12} stroke={C.mint} strokeWidth={2} opacity={0.15} />
      ))}
      {layout.docks.length > 1
        ? layout.docks.slice(1).map((d) => <line key={d.id} x1={d.x} x2={d.x} y1={YARD_Y + 10} y2={LANE_Y - 20} stroke={C.line} strokeWidth={2} strokeDasharray="14 12" opacity={0.5} />)
        : null}

      {/* waiting lane */}
      <line x1={0} x2={W} y1={LANE_Y - 8} y2={LANE_Y - 8} stroke={C.mint} strokeWidth={3} strokeDasharray="22 12" opacity={0.6} />
      <text x={16} y={LANE_Y + 22} fontSize={18} fontWeight={700} fill={C.mint}>ลานรอเรียก</text>
      <text x={W - 16} y={LANE_Y + 22} textAnchor="end" fontSize={15} fill={C.mintSoft} opacity={0.8}>
        {layout.waiting.length + layout.overflow > 0 ? `${layout.waiting.length + layout.overflow} คัน · เรียกตามลำดับ ▲` : 'ไม่มีรถรอเรียก'}
      </text>
      {layout.waiting.map((t, i) => {
        const tx = i * laneSlot + 40;
        const ty = LANE_Y + 44;
        return (
          <g key={t.id}>
            <Truck t={t} x={tx} y={ty} scale={laneScale} tone="waiting" />
            <Badge
              x={tx + 26}
              y={ty + 4}
              width={Math.min(laneSlot - 76, 150)}
              tone="waiting"
              lines={[
                { text: t.queue, size: 26, weight: 800 },
                { text: t.plate, size: 19, weight: 700, fill: C.mint },
                { text: t.time || ' ', size: 14, fill: C.mintSoft },
              ]}
            />
          </g>
        );
      })}
      {layout.overflow > 0 ? (
        <text x={layout.waiting.length * laneSlot + 30} y={LANE_Y + 120} fontSize={30} fontWeight={800} fill={C.mint}>+{layout.overflow}</text>
      ) : null}
    </svg>
  );
}
