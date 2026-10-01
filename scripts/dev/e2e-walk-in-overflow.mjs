#!/usr/bin/env node
/**
 * E2E for the walk-in overflow feature (202610010001_walk_in_overflow) on a LOCAL
 * Supabase stack + `next dev`. Drives the real portal UI with Playwright and
 * checks the API / DB behind it. Screenshots + results.json land in
 * docs/test-evidence/<date>-walk-in-overflow/.
 *
 * Scenarios (today's working hours are moved on the local DB so every case is
 * reproducible whatever the wall clock says):
 *   1. free      — working hours still have free slots: the picker says "ว่าง N ช่อง", a slot is taken.
 *   2. full      — every regular slot is filled: the picker says "เวลาทำการเต็ม" + last queue, the truck queues after it.
 *   3. after     — closing time already passed: only "ต่อท้าย" slots, starting from now / the last queue.
 *   4. regular   — the ordinary "สร้างคิว" drawer never offers an overflow slot (regression).
 *
 * Env: APP_URL (default http://localhost:3100), QA_EMAIL / QA_PASSWORD (portal admin),
 *      NEXT_PUBLIC_SUPABASE_URL (must be localhost), SUPABASE_SERVICE_ROLE_KEY, PLAYWRIGHT_CORE.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { APP_URL, desktop, launch, login, settle } from '../../docs/manuals/capture_lib.mjs';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const EMAIL = process.env.QA_EMAIL || 'admin@ui.local';
const PASSWORD = process.env.QA_PASSWORD || '';
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(SB_URL)) { console.error('Refusing to run: NEXT_PUBLIC_SUPABASE_URL is not a local stack'); process.exit(1); }
if (!SB_KEY || !PASSWORD) { console.error('Need SUPABASE_SERVICE_ROLE_KEY and QA_PASSWORD'); process.exit(1); }

const db = createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const must = (res, what) => { if (res.error) throw new Error(`${what}: ${res.error.message}`); return res.data; };
const bkk = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
const part = (t) => bkk().find((p) => p.type === t)?.value ?? '';
const today = () => `${part('year')}-${part('month')}-${part('day')}`;
const nowHM = () => `${part('hour')}:${part('minute')}`;
const hm = (t) => String(t).slice(0, 5);

const DATE = today();
const DIR = path.resolve(`docs/test-evidence/${DATE}-walk-in-overflow`);
fs.mkdirSync(DIR, { recursive: true });
const results = [];
const log = (m) => console.log(`[${nowHM()}] ${m}`);
function check(name, ok, detail = '') { results.push({ name, ok: Boolean(ok), detail }); log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); }
async function shot(page, name) { const f = path.join(DIR, `${name}.png`); await page.screenshot({ path: f, fullPage: false }); log(`shot ${name}`); return f; }

// ---------- seed ----------
const shop = must(await db.from('shops').select('id,company_id').eq('shop_key', process.env.SITE_SHOP_KEY || 'fameline').single(), 'shop');
const branch = must(await db.from('branches').select('id').eq('shop_id', shop.id).eq('is_deleted', false).order('created_at').limit(1).single(), 'branch');
const service = must(await db.from('services').select('id,service_name,duration_minutes').eq('shop_id', shop.id).eq('is_deleted', false).eq('active', true).order('sort_order').limit(1).single(), 'service');
const weekday = new Date(`${DATE}T00:00:00Z`).getUTCDay();
const docks = must(await db.from('booking_resources').select('id,resource_name,direction').eq('shop_id', shop.id).eq('resource_type', 'dock').eq('is_deleted', false), 'docks');
log(`site ok · branch ${branch.id.slice(0, 8)} · vehicle "${service.service_name}" ${service.duration_minutes} นาที · docks ${docks.length}`);

async function setClose(close) {
  must(await db.from('working_hours').update({ close_time: close }).eq('shop_id', shop.id).eq('weekday', weekday), 'working_hours');
  log(`working hours today (weekday ${weekday}) close_time → ${close}`);
}
const ORIGINAL_CLOSE = (must(await db.from('working_hours').select('close_time').eq('shop_id', shop.id).eq('weekday', weekday).limit(1).maybeSingle(), 'wh'))?.close_time ?? '17:00:00';

// Partner + open, paid SOs for the walk-ins.
let customer = must(await db.from('customers').select('id').eq('shop_id', shop.id).eq('code', 'C-UI').maybeSingle(), 'customer');
if (!customer) customer = must(await db.from('customers').insert({ company_id: shop.company_id, shop_id: shop.id, partner_type: 'customer', code: 'C-UI', full_name: 'บริษัท ทดสอบ Walk-in จำกัด', phone: '0200000001' }).select('id').single(), 'customer insert');
// Clean slate for today (logs → bookings → test documents; FK order matters).
const oldIds = (must(await db.from('bookings').select('id').eq('shop_id', shop.id).eq('booking_date', DATE), 'old bookings')).map((b) => b.id);
if (oldIds.length) {
  must(await db.from('booking_logs').delete().in('booking_id', oldIds), 'booking_logs delete');
  must(await db.from('push_subscriptions').delete().in('booking_id', oldIds), 'push_subscriptions delete');
  must(await db.from('bookings').delete().in('id', oldIds), 'bookings delete');
}
must(await db.from('external_documents').delete().eq('shop_id', shop.id).like('doc_no', 'SO-UI-%'), 'documents delete');
const SO = {};
for (const n of ['001', '002', '003']) {
  SO[n] = must(await db.from('external_documents').insert({ company_id: shop.company_id, shop_id: shop.id, branch_id: branch.id, doc_type: 'so', doc_no: `SO-UI-${n}`, partner_id: customer.id, partner_name: 'บริษัท ทดสอบ Walk-in จำกัด', status: 'open', source: 'manual', payment_status: 'paid' }).select('id,doc_no').single(), `SO-UI-${n}`);
}
log(`seeded ${Object.keys(SO).length} paid SOs, cleared today's queues`);

async function slots(overflow) {
  return must(await db.rpc('get_dock_slots', { p_shop_id: shop.id, p_branch_id: branch.id, p_direction: 'outbound', p_service_id: service.id, p_date: DATE, p_resource_id: null, p_exclude_booking_id: null, p_overflow: overflow }), 'get_dock_slots');
}
/** Fill every regular slot that has not finished yet (the running one included) on every dock. */
async function fillRegular() {
  const now = nowHM();
  let made = 0;
  for (const s of await slots(false)) {
    if (hm(s.slot_end) <= now) continue;
    for (let i = 0; i < s.remaining_capacity; i++) {
      const r = await db.rpc('create_dock_booking', { p_shop_id: shop.id, p_branch_id: branch.id, p_direction: 'outbound', p_service_id: service.id, p_date: DATE, p_start: s.slot_time, p_customer_id: customer.id, p_plate_number: `FILL-${made + 1}`, p_status: 'confirmed', p_source: 'admin' });
      if (r.error) { log(`fill ${hm(s.slot_time)} refused: ${r.error.message}`); break; }
      made++;
    }
  }
  log(`filled ${made} regular slot(s)`);
  return made;
}

// ---------- browser ----------
const browser = await launch();
const ctx = await desktop(browser);
const page = await ctx.newPage();
const api = async (p, init) => page.evaluate(async ([p, init]) => { const r = await fetch(p, init); return { status: r.status, body: await r.json().catch(() => null) }; }, [p, init ?? {}]);

async function openWalkIn(docNo, vehicle = /กระบะ/) {
  await page.goto(`${APP_URL}/portal/queue-board`, { waitUntil: 'domcontentloaded' });
  await settle(page);
  await page.getByRole('button', { name: 'Walk-in' }).first().click();
  const d = page.getByRole('dialog');
  await d.getByLabel(/^เอกสาร/).fill(docNo);
  await page.getByRole('option', { name: new RegExp(docNo) }).first().click();
  await d.getByLabel(/ประเภทรถ/).click();
  await page.getByRole('option', { name: vehicle }).first().click();
  await d.getByLabel('ทะเบียนรถ').fill(`70-${docNo.slice(-3)}1`);
  await d.getByLabel('ชื่อคนขับ').fill('สมหมาย ขับดี');
  await d.getByLabel('เบอร์คนขับ').fill('0891234567');
  await settle(page, 800);
  return d;
}
const summaryText = async (d) => (await d.locator('.MuiPaper-root').filter({ hasText: /คิวสุดท้าย|ยังไม่มีคิว/ }).first().innerText().catch(() => '')).replace(/\s+/g, ' ');

try {
  await login(page, EMAIL, PASSWORD);
  log(`logged in as ${EMAIL}`);

  // ===== 1. free =====
  await setClose('19:00');
  await page.waitForTimeout(500);
  let d = await openWalkIn('SO-UI-001');
  let sum = await summaryText(d);
  await shot(page, '01-free-picker');
  check('1a picker shows free count + no last queue', /ว่าง \d+ ช่อง/.test(sum) && /ยังไม่มีคิว/.test(sum), sum);
  check('1b no "ต่อท้าย" offered while regular slots are free', (await d.getByRole('button', { name: /^\d{2}:\d{2} ต่อท้าย/ }).count()) === 0);
  let apiFree = await api(`/api/available-slots?walk_in=1&direction=outbound&service_id=${service.id}&branch_id=${branch.id}`);
  check('1c API walk_in=1 returns overflow rows + meta.now', apiFree.status === 200 && apiFree.body.data.some((s) => s.overflow) && Boolean(apiFree.body.meta?.now), `rows=${apiFree.body?.data?.length} overflow=${apiFree.body?.data?.filter((s) => s.overflow).length} now=${apiFree.body?.meta?.now}`);
  const freeBtn = d.getByRole('button', { name: /^\d{2}:\d{2} ว่าง/ }).first();
  const freeLabel = (await freeBtn.innerText()).replace(/\s+/g, ' ');
  await freeBtn.click();
  await shot(page, '02-free-selected');
  check('1d submit button says "สร้างคิว + เช็คอิน" for a regular slot', await d.getByRole('button', { name: 'สร้างคิว + เช็คอิน' }).isVisible(), freeLabel);
  await d.getByRole('button', { name: 'สร้างคิว + เช็คอิน' }).click();
  await d.getByText('เลขคิว').waitFor({ timeout: 30000 });
  await settle(page, 800);
  await shot(page, '03-free-result');
  let resultText = (await d.innerText()).replace(/\s+/g, ' ');
  check('1e queue created, checked in / called, no "ต่อท้ายคิว" chip', /สร้างคิว ออก DO และเช็คอินแล้ว/.test(resultText) && !/ต่อท้ายคิว/.test(resultText), resultText.slice(0, 160));
  await d.getByRole('button', { name: 'เสร็จสิ้น' }).click();

  // ===== 2. full =====
  const filled = await fillRegular();
  check('2a regular slots filled by seed', filled > 0, `${filled} bookings`);
  const regularLeft = (await slots(false)).filter((s) => s.remaining_capacity > 0 && hm(s.slot_end) > nowHM()).length;
  check('2b no regular slot left (DB)', regularLeft === 0, `left=${regularLeft}`);
  d = await openWalkIn('SO-UI-002');
  sum = await summaryText(d);
  await shot(page, '04-full-picker');
  check('2c picker says "เวลาทำการเต็ม" + last queue + "ต่อท้ายคิวได้ตั้งแต่"', /เวลาทำการเต็ม/.test(sum) && /คิวสุดท้ายวันนี้ [RS]-\d{3}/.test(sum) && /ต่อท้ายคิวได้ตั้งแต่ \d{2}:\d{2}/.test(sum), sum);
  const fullBtns = await d.getByRole('button', { name: /^\d{2}:\d{2} เต็ม/ }).count();
  const overBtns = await d.getByRole('button', { name: /^\d{2}:\d{2} ต่อท้าย/ }).count();
  check('2d full slots shown disabled, ≤3 "ต่อท้าย" slots offered', fullBtns > 0 && overBtns >= 1 && overBtns <= 3, `เต็ม=${fullBtns} ต่อท้าย=${overBtns}`);
  const firstOver = (await slots(true)).find((s) => s.overflow && s.remaining_capacity > 0);
  const deny = await api('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ direction: 'outbound', service_id: service.id, branch_id: branch.id, booking_date: DATE, start_time: hm(firstOver.slot_time), plate_number: '99-9999', partner_name: 'ลูกค้าทั่วไป' }) });
  check('2e regular create refuses the overflow slot (409 slot_unavailable)', deny.status === 409 && deny.body?.code === 'slot_unavailable', `status=${deny.status} code=${deny.body?.code} slot=${hm(firstOver.slot_time)}`);
  const overBtn = d.getByRole('button', { name: /^\d{2}:\d{2} ต่อท้าย/ }).first();
  const overLabel = (await overBtn.innerText()).replace(/\s+/g, ' ');
  await overBtn.click();
  await shot(page, '05-full-selected');
  check('2f submit button says "ต่อท้ายคิว + เช็คอิน"', await d.getByRole('button', { name: 'ต่อท้ายคิว + เช็คอิน' }).isVisible(), overLabel);
  await d.getByRole('button', { name: 'ต่อท้ายคิว + เช็คอิน' }).click();
  await d.getByText('เลขคิว').waitFor({ timeout: 30000 });
  await settle(page, 800);
  await shot(page, '06-full-result');
  resultText = (await d.innerText()).replace(/\s+/g, ' ');
  const qFull = resultText.match(/เลขคิว ([RS]-\d{3})/)?.[1];
  check('2g result shows "ต่อท้ายคิว" chip + queue number', Boolean(qFull) && /ต่อท้ายคิว/.test(resultText), resultText.slice(0, 200));
  const rowFull = must(await db.from('bookings').select('queue_number,start_time,status,resource_id,booking_source,do_number').eq('shop_id', shop.id).eq('booking_date', DATE).eq('queue_number', qFull).single(), 'booking');
  check('2h DB: walk_in source, slot ≥ closing (19:00), dock + DO assigned', rowFull.booking_source === 'walk_in' && hm(rowFull.start_time) >= '19:00' && rowFull.resource_id && rowFull.do_number, JSON.stringify(rowFull));
  await d.getByRole('button', { name: 'เสร็จสิ้น' }).click();

  // ===== 3. after hours =====
  await setClose('15:00');
  d = await openWalkIn('SO-UI-003');
  sum = await summaryText(d);
  await shot(page, '07-after-hours-picker');
  const regularBtns = await d.getByRole('button', { name: /^\d{2}:\d{2} (ว่าง|เต็ม)/ }).count();
  const overBtns3 = await d.getByRole('button', { name: /^\d{2}:\d{2} ต่อท้าย/ }).count();
  check('3a after closing: no regular slot, only "ต่อท้าย"', regularBtns === 0 && overBtns3 >= 1 && /เวลาทำการเต็ม/.test(sum), `regular=${regularBtns} ต่อท้าย=${overBtns3} · ${sum}`);
  const firstOver3 = (await d.getByRole('button', { name: /^\d{2}:\d{2} ต่อท้าย/ }).first().innerText()).slice(0, 5);
  // The earliest "ต่อท้าย" is per dock: another dock may be free before the busiest one's tail.
  const apiFirst = (await slots(true)).find((s) => s.overflow && s.remaining_capacity > 0 && hm(s.slot_end) > nowHM());
  check('3b first "ต่อท้าย" slot = earliest free overflow slot of the API, not in the past', apiFirst && firstOver3 === hm(apiFirst.slot_time) && firstOver3 >= nowHM(), `ui=${firstOver3} api=${hm(apiFirst?.slot_time)} remaining=${apiFirst?.remaining_capacity} now=${nowHM()}`);
  await d.getByRole('button', { name: /^\d{2}:\d{2} ต่อท้าย/ }).first().click();
  await d.getByRole('button', { name: 'ต่อท้ายคิว + เช็คอิน' }).click();
  await d.getByText('เลขคิว').waitFor({ timeout: 30000 });
  await settle(page, 800);
  await shot(page, '08-after-hours-result');
  resultText = (await d.innerText()).replace(/\s+/g, ' ');
  check('3c queued after hours with DO', /เลขคิว [RS]-\d{3}/.test(resultText) && /DO-/.test(resultText), resultText.slice(0, 160));
  await d.getByRole('button', { name: 'เสร็จสิ้น' }).click();

  // ===== 4. regression: ordinary create never sees overflow =====
  const plain = await api(`/api/available-slots?date=${DATE}&direction=outbound&service_id=${service.id}&branch_id=${branch.id}`);
  const maxEnd = plain.body.data.reduce((m, s) => (hm(s.slot_end) > m ? hm(s.slot_end) : m), '00:00');
  check('4a GET /api/available-slots (no walk_in) ends at closing, no overflow rows', plain.status === 200 && maxEnd <= '15:00' && !plain.body.data.some((s) => s.overflow), `rows=${plain.body.data.length} maxEnd=${maxEnd}`);
  await page.goto(`${APP_URL}/portal/bookings`, { waitUntil: 'domcontentloaded' });
  await settle(page);
  await page.getByRole('button', { name: /^สร้างคิว$/ }).first().click();
  const drawer = page.locator('.MuiDrawer-paper').last();
  await drawer.getByLabel(/ประเภทรถ/).click();
  await page.getByRole('option', { name: /กระบะ/ }).first().click();
  await settle(page, 800);
  await shot(page, '09-regular-create-days');
  const drawerText = (await drawer.innerText()).replace(/\s+/g, ' ');
  check('4b "สร้างคิว" drawer offers no "ต่อท้าย" and skips today (full)', !/ต่อท้าย/.test(drawerText) && !new RegExp(`${Number(DATE.slice(8, 10))} `).test(drawerText.split('วันที่ว่าง')[1]?.slice(0, 40) ?? ''), drawerText.slice(0, 160));

  // ===== board =====
  await page.goto(`${APP_URL}/portal/queue-board`, { waitUntil: 'domcontentloaded' });
  await settle(page);
  await shot(page, '10-board');
  const walkIns = must(await db.from('bookings').select('queue_number,start_time,status,resource_name,booking_source').eq('shop_id', shop.id).eq('booking_date', DATE).eq('booking_source', 'walk_in').order('start_time'), 'walk-ins');
  check('5 three walk-ins exist today (1 regular + 2 overflow)', walkIns.length === 3, walkIns.map((w) => `${w.queue_number} ${hm(w.start_time)} ${w.status} ${w.resource_name ?? '-'}`).join(' | '));
} catch (e) {
  check('run aborted', false, e instanceof Error ? e.message : String(e));
  await shot(page, '99-error').catch(() => {});
} finally {
  await setClose(ORIGINAL_CLOSE).catch(() => {});
  await browser.close();
}

const passed = results.filter((r) => r.ok).length;
fs.writeFileSync(path.join(DIR, 'results.json'), JSON.stringify({ date: DATE, app: APP_URL, vehicle: service.service_name, passed, total: results.length, results }, null, 2));
log(`${passed}/${results.length} passed → ${DIR}`);
process.exit(passed === results.length ? 0 : 1);
