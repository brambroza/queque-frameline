#!/usr/bin/env node
/**
 * Pictures for the two LINE manuals (docs/manuals/screenshots/line/).
 *
 * LINE chats cannot be captured from a headless browser, so each picture is a
 * phone-sized chat drawn here: the message objects come from the real builders in
 * src/lib/line/messages.ts (same Flex JSON the OA sends) and the rich menu from
 * src/components/forms/rich-menu-canvas.ts. Sample data only — no database, no LINE API.
 *
 * Usage: node docs/manuals/capture_line.mjs [--only=l1,g2]
 * Env: OA_NAME (chat title, default "Fameline Queue"), GROUP_NAME (default "WMS").
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch, shot } from './capture_lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../..');
const require = createRequire(import.meta.url);
const ts = require(path.join(root, 'node_modules/typescript'));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ONLY = args.only ? String(args.only).split(',') : null;
const OA_NAME = process.env.OA_NAME || 'Fameline Queue';
const GROUP_NAME = process.env.GROUP_NAME || 'WMS';
const DIR = path.join(here, 'screenshots', 'line');

// ───────────────────────── load the real builders ─────────────────────────

/** Transpile the TS modules to a temp folder so plain node / the browser can use them. */
function transpile() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'line-manual-'));
  const files = { 'messages.mjs': 'src/lib/line/messages.ts', 'rich-menu.mjs': 'src/lib/line/rich-menu.ts', 'rich-menu-canvas.mjs': 'src/components/forms/rich-menu-canvas.ts' };
  for (const [out, src] of Object.entries(files)) {
    const code = ts.transpileModule(fs.readFileSync(path.join(root, src), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
      .replaceAll("'@/lib/line/rich-menu'", "'./rich-menu.mjs'");
    fs.writeFileSync(path.join(tmp, out), code);
  }
  return tmp;
}
const tmp = transpile();
const M = await import(pathToFileURL(path.join(tmp, 'messages.mjs')).href);
const canvasSrc = fs.readFileSync(path.join(tmp, 'rich-menu-canvas.mjs'), 'utf8');
const richMenuSrc = fs.readFileSync(path.join(tmp, 'rich-menu.mjs'), 'utf8');

// ───────────────────────── sample data (matches the portal manuals) ─────────────────────────

const SITE = 'Fameline Warehouse';
const WEB = 'https://queque-frameline.vercel.app';
const base = { siteName: SITE, direction: 'outbound', docNo: 'SO-2609106', date: '2026-10-02', startTime: '08:00', endTime: '08:45', dock: null, plate: '715520', vehicleType: 'รถ 6 ล้อ', doNo: null, statusUrl: `${WEB}/book/…`, driverUrl: `${WEB}/driver/…` };
const confirmed = { ...base, queueNo: 'R-004', doNo: 'DO-202610-0031', dock: 'ท่า 1 (รับสินค้า)' };

// ───────────────────────── chat page ─────────────────────────

/** Browser-side Flex renderer (box / text / button / separator) close enough to LINE for a manual. */
const FLEX_JS = String.raw`
const SIZE = { xxs: 10, xs: 11, sm: 13, md: 14, lg: 16, xl: 19, xxl: 22 };
const GAP = { none: 0, xs: 2, sm: 4, md: 8, lg: 12, xl: 16, xxl: 20 };
const px = (v, d = 0) => v == null ? d : (GAP[v] ?? parseInt(v, 10));
function node(c, parentLayout) {
  if (c.type === 'box') {
    const el = document.createElement('div');
    el.style.display = 'flex';
    el.style.flexDirection = c.layout === 'horizontal' || c.layout === 'baseline' ? 'row' : 'column';
    if (c.layout === 'baseline') el.style.alignItems = 'baseline';
    el.style.gap = px(c.spacing) + 'px';
    if (c.backgroundColor) el.style.background = c.backgroundColor;
    if (c.paddingAll) el.style.padding = px(c.paddingAll) + 'px';
    if (c.paddingStart) el.style.paddingLeft = px(c.paddingStart) + 'px';
    if (c.paddingEnd) el.style.paddingRight = px(c.paddingEnd) + 'px';
    if (c.cornerRadius) el.style.borderRadius = (c.cornerRadius === 'md' ? 6 : px(c.cornerRadius)) + 'px';
    if (parentLayout === 'horizontal') el.style.flex = c.flex != null ? String(c.flex) : '0 0 auto';
    if (c.margin) el.style.marginTop = px(c.margin) + 'px';
    (c.contents || []).forEach((k) => el.appendChild(node(k, c.layout)));
    return el;
  }
  if (c.type === 'text') {
    const el = document.createElement('div');
    el.textContent = c.text;
    el.style.fontSize = (SIZE[c.size] || 14) + 'px';
    el.style.lineHeight = '1.35';
    el.style.color = c.color || '#111';
    el.style.fontWeight = c.weight === 'bold' ? '700' : '400';
    el.style.textAlign = c.align === 'end' ? 'right' : c.align || 'left';
    if (!c.wrap) { el.style.whiteSpace = 'nowrap'; el.style.overflow = 'hidden'; el.style.textOverflow = 'ellipsis'; }
    if (parentLayout === 'horizontal' || parentLayout === 'baseline') { el.style.flex = String(c.flex ?? 1); el.style.minWidth = '0'; }
    if (c.margin) el.style.marginTop = px(c.margin) + 'px';
    return el;
  }
  if (c.type === 'button') {
    const el = document.createElement('div');
    el.textContent = c.action.label;
    const primary = c.style === 'primary';
    el.style.cssText = 'height:38px;display:flex;align-items:center;justify-content:center;border-radius:6px;font-size:14px;font-weight:600;';
    el.style.background = primary ? (c.color || '#17C950') : '#EEF0F3';
    el.style.color = primary ? '#fff' : '#1E2A3A';
    return el;
  }
  if (c.type === 'separator') { const el = document.createElement('div'); el.style.cssText = 'height:1px;background:' + (c.color || '#e5e7eb') + ';margin-top:' + px(c.margin, 8) + 'px'; return el; }
  return document.createElement('div');
}
function bubble(b) {
  const el = document.createElement('div');
  el.className = 'flex ' + (b.size || 'mega');
  for (const part of ['header', 'body', 'footer']) if (b[part]) el.appendChild(node(b[part]));
  return el;
}
function renderFlex(contents) {
  if (contents.type === 'carousel') {
    const row = document.createElement('div'); row.className = 'carousel';
    contents.contents.forEach((b) => row.appendChild(bubble(b)));
    return row;
  }
  return bubble(contents);
}`;

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans Thai','Noto Sans',sans-serif;background:#fff;width:390px}
.phone{width:390px;height:var(--h);display:flex;flex-direction:column;overflow:hidden;background:#8FA9D3}
.top{height:52px;flex:none;background:#2B3A55;color:#fff;display:flex;align-items:center;gap:10px;padding:0 14px;font-size:16px;font-weight:600}
.top .back{font-size:22px;opacity:.9}.top .sub{font-size:11px;font-weight:400;opacity:.75}
.chat{flex:1;overflow:hidden;padding:12px 10px;display:flex;flex-direction:column;gap:12px}
.day{align-self:center;background:#0000002a;color:#fff;font-size:11px;padding:3px 10px;border-radius:10px}
.msg{display:flex;gap:8px;align-items:flex-start}
.msg .av{width:34px;height:34px;border-radius:50%;flex:none;background:#14452F;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:15px}
.msg .av.u{background:#C9D6E8;color:#2B3A55}
.msg .who{font-size:11px;color:#fff;margin:0 0 3px 2px;opacity:.9}
.msg .col{display:flex;flex-direction:column;max-width:310px;min-width:0}
.msg .line{display:flex;align-items:flex-end;gap:5px}
.msg .t{font-size:10px;color:#ffffffcc;white-space:nowrap}
.text{background:#fff;border-radius:16px;padding:9px 12px;font-size:14px;line-height:1.45;white-space:pre-wrap;color:#111;max-width:270px}
.me{justify-content:flex-end}.me .text{background:#8DE055}
.flex{background:#fff;border-radius:14px;overflow:hidden;flex:none}
.flex.mega{width:290px}.flex.kilo{width:240px}
.carousel{display:flex;gap:8px;width:330px;overflow:hidden}
.rich{flex:none;background:#fff;border-top:1px solid #d7dce4}
.rich img{display:block;width:390px}
.rich .bar{height:30px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#555;border-top:1px solid #eee}
.input{flex:none;height:46px;background:#fff;border-top:1px solid #d7dce4;display:flex;align-items:center;gap:10px;padding:0 12px;color:#9aa3ad;font-size:13px}
.input .box{flex:1;height:32px;border-radius:16px;background:#F1F3F6;display:flex;align-items:center;padding:0 12px}
`;

/** One chat screen. `items`: {day} | {from:'oa'|'me'|'member', name?, text? | flex?, t}. */
function chatHtml({ title, sub, items, rich = false, height = 760 }) {
  const msgs = items.map((m) => {
    if (m.day) return `<div class="day">${m.day}</div>`;
    const t = `<span class="t">${m.t ?? ''}</span>`;
    const content = m.flex ? `<div class="flexslot" data-flex='${JSON.stringify(m.flex.contents).replaceAll("'", '&#39;')}'></div>` : `<div class="text">${m.text.replaceAll('<', '&lt;')}</div>`;
    if (m.from === 'me') return `<div class="msg me"><div class="line">${t}${content}</div></div>`;
    const av = m.from === 'member' ? `<div class="av u">${(m.name ?? 'ส')[0]}</div>` : '<div class="av">F</div>';
    const who = m.from === 'member' ? m.name : OA_NAME;
    return `<div class="msg">${av}<div class="col"><div class="who">${who}</div><div class="line">${content}${t}</div></div></div>`;
  }).join('');
  const bottom = rich ? '<div class="rich"><img id="rich"><div class="bar">เมนู ▾</div></div>' : '<div class="input"><span>＋</span><div class="box">Aa</div><span>☺</span></div>';
  return `<!doctype html><html lang="th"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;600;700&family=Kanit:wght@400;600;700&display=swap">
<style>${CSS}</style></head><body><div class="phone" style="--h:${height}px">
<div class="top"><span class="back">‹</span><div><div>${title}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div></div>
<div class="chat">${msgs}</div>${bottom}</div>
<script>${FLEX_JS}
document.querySelectorAll('.flexslot').forEach((s) => s.replaceWith(renderFlex(JSON.parse(s.dataset.flex))));
</script>
<script type="module">
${richMenuSrc.replace(/^export /gm, '')}
${canvasSrc.replace(/^import .*$/m, '').replace(/^export /gm, '')}
const img = document.getElementById('rich');
if (img) { await document.fonts.load('700 40px Kanit'); await document.fonts.load('400 40px Kanit'); const c = document.createElement('canvas'); drawRichMenu(c, 'Kanit'); img.src = c.toDataURL('image/png'); }
window.__ready = true;
</script></body></html>`;
}

// ───────────────────────── screens ─────────────────────────

const oa = (msg, t) => ({ from: 'oa', ...(msg.type === 'flex' ? { flex: msg } : { text: msg.text }), t });
const me = (text, t) => ({ from: 'me', text, t });

const myQueues = M.myQueuesFlex([
  { queueNo: 'R-004', status: 'confirmed', direction: 'outbound', date: '2026-10-02', startTime: '08:00', endTime: '08:45', dock: null, plate: '715520', doNo: 'DO-202610-0031', docNo: 'SO-2609106', url: WEB, role: 'partner' },
  { queueNo: 'R-015', status: 'pending', direction: 'outbound', date: '2026-10-07', startTime: '13:30', endTime: '14:15', dock: null, plate: '70-8812', doNo: null, docNo: 'SO-2609104', url: WEB, role: 'partner', paymentPending: true },
]);
const myDocs = M.myDocsFlex([
  { docNo: 'SO-2609106', docType: 'so', partnerName: 'บริษัท สยามเฟอร์นิเจอร์ จำกัด', status: 'booked', dueDate: '2026-10-03', itemCount: 0, paymentStatus: 'paid', queues: [{ queueNo: 'R-004', status: 'confirmed', date: '2026-10-02', startTime: '08:00' }], url: WEB },
  { docNo: 'SO-2609104', docType: 'so', partnerName: 'บริษัท สยามเฟอร์นิเจอร์ จำกัด', status: 'open', dueDate: '2026-10-08', itemCount: 0, paymentStatus: 'unpaid', queues: [], url: WEB },
]);
const contact = M.contactText({ siteName: SITE, branches: [{ name: 'คลังสินค้าบางนา', phone: '02-123-4567', address: '99 หมู่ 5 ถ.บางนา-ตราด กม.23 บางเสาธง สมุทรปราการ' }], phone: null, address: null });

const SCREENS = {
  // customer / supplier
  'l1-welcome': { title: OA_NAME, rich: true, items: [{ day: 'วันนี้' }, oa(M.welcomeText(SITE), '09:02')] },
  'l2-link': { title: OA_NAME, items: [{ day: 'พฤ. 1 ต.ค.' }, oa(M.bookingLinkFlex({ docNo: 'SO-2609106', partnerName: 'บริษัท สยามเฟอร์นิเจอร์ จำกัด', direction: 'outbound', dueDate: '2026-10-03', siteName: SITE, url: WEB }), '15:10')] },
  'l3-submitted': { title: OA_NAME, items: [{ day: 'พฤ. 1 ต.ค.' }, oa(M.bookingSubmittedFlex({ ...base, queueNo: 'R-004', paymentPending: true }), '15:21')] },
  'l4-confirmed': { title: OA_NAME, items: [{ day: 'พฤ. 1 ต.ค.' }, oa(M.bookingConfirmedFlex(confirmed), '16:05')] },
  'l5-my-queues': { title: OA_NAME, rich: true, items: [me('คิวของฉัน', '16:30'), oa(myQueues, '16:30')] },
  'l6-my-docs': { title: OA_NAME, rich: true, items: [me('สถานะ SO', '16:31'), oa(myDocs, '16:31')] },
  'l7-contact': { title: OA_NAME, rich: true, items: [me('ติดต่อคลัง', '16:32'), oa(contact, '16:32')] },
  'l8-driver-job': { title: OA_NAME, items: [{ day: 'พฤ. 1 ต.ค.' }, oa(M.driverJobFlex({ ...confirmed, driverUrl: WEB }), '16:10')] },
  'l9-waiting': { title: OA_NAME, items: [{ day: 'ศ. 2 ต.ค.' }, oa(M.bookingWaitingFlex(confirmed), '08:05')] },
  'l10-called': { title: OA_NAME, items: [{ day: 'ศ. 2 ต.ค.' }, oa(M.bookingCalledFlex(confirmed), '08:12')] },
  'l11-not-linked': { title: OA_NAME, rich: true, items: [me('คิวของฉัน', '08:40'), oa(M.notLinkedText(SITE), '08:40')] },
  'l12-late': { title: OA_NAME, items: [{ day: 'ศ. 2 ต.ค.' }, oa(M.bookingLateFlex({ ...confirmed, graceMinutes: 30, autoNoShow: true, who: 'partner' }), '08:16')] },
  // warehouse group
  'g1-register': { title: GROUP_NAME, sub: 'กลุ่ม · สมาชิก 8 คน', items: [
    { day: 'วันนี้' },
    oa(M.groupJoinedText(), '08:01'),
    me(M.GROUP_REGISTER_COMMAND, '08:02'),
    oa(M.groupRegisteredText(GROUP_NAME), '08:02'),
  ] },
  'g2-feed': { title: GROUP_NAME, sub: 'กลุ่ม · สมาชิก 8 คน', height: 820, items: [
    { day: 'พฤ. 1 ต.ค.' },
    oa(M.staffGroupText({ kind: 'submitted', queueNo: 'R-004', partner: 'บริษัท สยามเฟอร์นิเจอร์ จำกัด', docNo: 'SO-2609106', date: '2026-10-02', time: '08:00', plate: '715520', vehicle: 'รถ 6 ล้อ', pending: true }), '15:21'),
    oa(M.staffGroupText({ kind: 'payment_cleared', docNo: 'SO-2609106', partner: 'บริษัท สยามเฟอร์นิเจอร์ จำกัด', queues: ['R-004'], status: 'ชำระแล้ว' }), '15:40'),
    { day: 'ศ. 2 ต.ค.' },
    oa(M.staffGroupText({ kind: 'arrived', queueNo: 'R-004', plate: '715520', dock: 'ท่า 1 (รับสินค้า)', by: 'driver' }), '07:52'),
    oa(M.staffGroupText({ kind: 'auto_called', queueNo: 'R-004', plate: '715520', dock: 'ท่า 1 (รับสินค้า)' }), '08:12'),
    oa(M.staffGroupText({ kind: 'late', queueNo: 'S-004', partner: 'บริษัท ไทยอลูมิเนียม จำกัด', time: '10:00' }), '10:31'),
  ] },
  'g3-alerts': { title: GROUP_NAME, sub: 'กลุ่ม · สมาชิก 8 คน', height: 820, items: [
    oa(M.staffGroupText({ kind: 'plate_mismatch', queueNo: 'R-014', booked: '70-8812', actual: '70-8821' }), '11:05'),
    oa(M.staffGroupText({ kind: 'vehicle_changed', queueNo: 'R-015', partner: 'บริษัท สยามเฟอร์นิเจอร์ จำกัด', date: '2026-10-07', time: '13:30', plate: { from: '70-8812', to: '715520' }, driver: { from: 'สมศักดิ์', to: 'วีระ' } }), '11:20'),
    oa(M.staffGroupText({ kind: 'customer_cancelled', queueNo: 'R-016', partner: 'ห้างหุ้นส่วนจำกัด ธนพัฒน์การค้า', date: '2026-10-07', time: '15:00' }), '11:42'),
    oa(M.staffGroupText({ kind: 'unpaid_cancelled', queueNo: 'R-017', partner: 'บริษัท สยามเฟอร์นิเจอร์ จำกัด', docNo: 'SO-2609104', date: '2026-10-07', time: '09:30' }), '12:00'),
    oa(M.staffGroupText({ kind: 'no_show', queueNo: 'S-004', partner: 'บริษัท ไทยอลูมิเนียม จำกัด', date: '2026-10-06', time: '10:00' }), '12:05'),
  ] },
};

// ───────────────────────── capture ─────────────────────────

fs.mkdirSync(DIR, { recursive: true });
const qr = path.join(DIR, 'oa-qr.png');
if (!fs.existsSync(qr)) {
  const res = await fetch('https://qr-official.line.me/gs/M_307ghkbr_GW.png?oat_content=qr');
  if (res.ok) fs.writeFileSync(qr, Buffer.from(await res.arrayBuffer()));
}
const browser = await launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2, locale: 'th-TH' });
  for (const [name, screen] of Object.entries(SCREENS)) {
    if (ONLY && !ONLY.some((o) => name.startsWith(o))) continue;
    // A fresh page per screen: setContent keeps window globals (the ready flag) across documents.
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.warn('  page error:', e.message));
    await page.setContent(chatHtml(screen), { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__ready === true);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.waitForFunction(() => !document.querySelector('.flexslot'));
    await shot(page, DIR, name, page.locator('.phone'));
    await page.close();
  }
} finally {
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
