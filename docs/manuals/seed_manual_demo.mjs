#!/usr/bin/env node
/**
 * Demo data for the user-manual screenshots (docs/manuals).
 *
 * LOCAL SUPABASE ONLY — refuses to run unless NEXT_PUBLIC_SUPABASE_URL points at
 * 127.0.0.1 / localhost. It wipes the site's partners, documents and queues, then
 * builds a realistic month: customers + suppliers, SO/PO, completed history for
 * the dashboard, today's queues in every board column, and future queues for the
 * calendar. Queues go through the real `create_dock_booking` RPC; lifecycle
 * timestamps are then set directly so KPI charts have data.
 *
 * Usage (env from the local stack, see docs/manuals/README.md):
 *   node docs/manuals/seed_manual_demo.mjs [--out=links.json]
 * Prints (and optionally writes) booking / driver links used by capture_manual.mjs.
 */
import fs from 'fs';
import { createHash, createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const TOKEN_SECRET = process.env.TOKEN_SECRET || KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3100';
const SHOP_KEY = process.env.SITE_SHOP_KEY || 'fameline';

if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(URL_)) {
  console.error('Refusing to run: NEXT_PUBLIC_SUPABASE_URL is not a local Supabase stack.');
  process.exit(1);
}
if (!KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const db = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

/** Throw on a Supabase error, else return the data. */
function must(res, what) { if (res.error) throw new Error(`${what}: ${res.error.message}`); return res.data; }
const token = (kind, id, v = 0) => createHmac('sha256', TOKEN_SECRET).update(`${kind}:${id}:${v}`, 'utf8').digest('base64url');
const sha = (t) => createHash('sha256').update(t, 'utf8').digest('hex');
const bkkDate = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(d);
const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekday = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();
/** ISO timestamp for a Bangkok wall-clock date + "HH:MM" + minute offset. */
const at = (date, hhmm, plus = 0) => new Date(new Date(`${date}T${hhmm}:00+07:00`).getTime() + plus * 60_000).toISOString();
const hm = (t) => String(t).slice(0, 5);
let seed = 7;
/** Deterministic pseudo-random int in [a, b]. */
const rnd = (a, b) => { seed = (seed * 9301 + 49297) % 233280; return a + Math.floor((seed / 233280) * (b - a + 1)); };

const CUSTOMERS = [
  { code: 'C001', full_name: 'บริษัท สยามเฟอร์นิเจอร์ จำกัด', phone: '021234501', email: 'purchase@siamfurniture.example', address: '88 ถ.บางนา-ตราด บางพลี สมุทรปราการ' },
  { code: 'C002', full_name: 'บริษัท โฮมเดคคอร์ (ประเทศไทย) จำกัด', phone: '021234502', email: 'order@homedecor.example', address: '12 ถ.ศรีนครินทร์ บางเมือง สมุทรปราการ' },
  { code: 'C003', full_name: 'ห้างหุ้นส่วนจำกัด ธนพัฒน์การค้า', phone: '021234503', email: 'tp@thanapat.example', address: '45 ถ.กิ่งแก้ว ราชาเทวะ บางพลี' },
  { code: 'C004', full_name: 'บริษัท ออฟฟิศพลัส จำกัด', phone: '021234504', email: 'buy@officeplus.example', address: '9 ถ.พระราม 9 ห้วยขวาง กรุงเทพฯ' },
  { code: 'C005', full_name: 'บริษัท บ้านสวยวัสดุ จำกัด', phone: '021234505', email: 'po@bansuay.example', address: '301 ถ.เทพารักษ์ บางพลี สมุทรปราการ' },
];
const SUPPLIERS = [
  { code: 'V001', full_name: 'บริษัท ไทยอลูมิเนียม อินดัสทรี จำกัด', phone: '027770001', email: 'sales@thaialu.example', address: 'นิคมอุตสาหกรรมบางปู สมุทรปราการ' },
  { code: 'V002', full_name: 'บริษัท กระจกไทย จำกัด', phone: '027770002', email: 'sales@thaiglass.example', address: 'ถ.สุขสวัสดิ์ พระประแดง สมุทรปราการ' },
  { code: 'V003', full_name: 'บริษัท สีพ่นสยาม จำกัด', phone: '027770003', email: 'sales@siampowder.example', address: 'ถ.เทพารักษ์ บางเสาธง สมุทรปราการ' },
];
const DRIVERS = [
  ['สมชาย ใจดี', '0811110001'], ['วิชัย ขับดี', '0811110002'], ['ประยุทธ์ รถใหญ่', '0811110003'], ['อนันต์ มั่นคง', '0811110004'],
  ['สุรชัย ตรงเวลา', '0811110005'], ['ธนา ขยันยิ่ง', '0811110006'], ['บุญมี ศรีสุข', '0811110007'], ['มานพ ศรีวิไล', '0811110008'],
];
const CATALOG_SO = [
  { sku: 'FL-WIN-S120', name: 'หน้าต่างบานเลื่อนอลูมิเนียม 120 ซม.', qty: 20, uom: 'SET' },
  { sku: 'FL-DOOR-SW90', name: 'ประตูบานสวิงอลูมิเนียม 90 ซม.', qty: 12, uom: 'SET' },
  { sku: 'AL-6063-T5-6M', name: 'อลูมิเนียมเส้น 6063 T5 ยาว 6 ม.', qty: 120, uom: 'PCS' },
  { sku: 'AL-SHEET-1.2', name: 'แผ่นอลูมิเนียม 1.2 มม. 4x8 ฟุต', qty: 40, uom: 'SHT' },
  { sku: 'FL-PART-WH', name: 'ชุดมือจับและอุปกรณ์ประตู', qty: 60, uom: 'SET' },
];
const CATALOG_PO = [
  { sku: 'RM-AL-BILLET', name: 'อลูมิเนียมแท่ง (Billet) 7 นิ้ว', qty: 12, uom: 'TON' },
  { sku: 'GL-6MM-CLR', name: 'กระจกใส 6 มม.', qty: 150, uom: 'SHT' },
  { sku: 'PWD-RAL9016', name: 'ผงสีพ่น ขาว RAL9016', qty: 400, uom: 'KG' },
  { sku: 'HW-BRK-SS', name: 'ขายึดสแตนเลส', qty: 2000, uom: 'PCS' },
];
const items = (cat, i) => Array.from({ length: 2 + (i % 2) }, (_, k) => cat[(i + k) % cat.length]);

async function main() {
  const shop = must(await db.from('shops').select('id,company_id').eq('shop_key', SHOP_KEY).single(), 'shop');
  const S = { shop_id: shop.id, company_id: shop.company_id };
  const today = bkkDate();
  const users = must(await db.from('users_profile').select('id,full_name,email').eq('shop_id', S.shop_id), 'users');
  const staffUser = users.find((u) => /manual/.test(u.email ?? '') && /คลัง/.test(u.full_name ?? '')) ?? users[0];

  // ── portal members: scripts/create-admin.mjs does not add `staff` rows, the staff page lists those ──
  for (const u of users) {
    const has = must(await db.from('staff').select('id').eq('shop_id', S.shop_id).eq('user_id', u.id).maybeSingle(), 'staff lookup');
    if (!has) must(await db.from('staff').insert({ ...S, user_id: u.id, display_name: u.full_name, active: true }), 'staff insert');
  }

  // ── wipe (local only) ──
  for (const t of ['booking_logs', 'notifications', 'activity_logs']) must(await db.from(t).delete().eq('shop_id', S.shop_id), `wipe ${t}`);
  must(await db.from('bookings').delete().eq('shop_id', S.shop_id), 'wipe bookings');
  must(await db.from('external_documents').delete().eq('shop_id', S.shop_id), 'wipe documents');
  must(await db.from('customers').delete().eq('shop_id', S.shop_id), 'wipe customers');
  must(await db.from('holidays').delete().eq('shop_id', S.shop_id), 'wipe holidays');

  // ── site + branches ──
  must(await db.from('shops').update({ phone: '02-123-4567', address: '99 หมู่ 5 ถ.บางนา-ตราด กม.23 ต.บางเสาธง อ.บางเสาธง จ.สมุทรปราการ 10570' }).eq('id', S.shop_id), 'shop');
  const branches = must(await db.from('branches').select('id,code').eq('shop_id', S.shop_id).order('created_at'), 'branches');
  const main = branches[0];
  must(await db.from('branches').update({ branch_name: 'คลังสินค้าบางนา', code: 'BN', address: '99 หมู่ 5 ถ.บางนา-ตราด กม.23 บางเสาธง สมุทรปราการ', phone: '02-123-4567', latitude: 13.6012, longitude: 100.8021, checkin_radius_m: 300 }).eq('id', main.id), 'branch main');
  if (!branches.find((b) => b.code === 'LKB')) {
    const b2 = must(await db.from('branches').insert({ ...S, branch_name: 'คลังสินค้าลาดกระบัง', code: 'LKB', address: 'นิคมอุตสาหกรรมลาดกระบัง กรุงเทพฯ', phone: '02-765-4321', open_time: '08:00', close_time: '17:00', active: true, latitude: 13.7280, longitude: 100.7610, checkin_radius_m: 300 }).select('id').single(), 'branch 2');
    must(await db.from('booking_resources').insert({ ...S, branch_id: b2.id, resource_type: 'dock', resource_code: 'L1', resource_name: 'ท่า L1 (รับ/ส่ง)', capacity: 1, active: true }), 'dock L1');
    must(await db.from('working_hours').insert([1, 2, 3, 4, 5].map((w) => ({ ...S, branch_id: b2.id, weekday: w, open_time: '08:00', close_time: '17:00', break_start: '12:00', break_end: '13:00', slot_interval_minutes: 30, capacity_per_slot: 1, active: true }))), 'hours L');
  }
  must(await db.from('holidays').insert([
    { ...S, branch_id: main.id, holiday_date: '2026-10-13', reason: 'วันคล้ายวันสวรรคต ร.9' },
    { ...S, branch_id: main.id, holiday_date: '2026-10-23', reason: 'วันปิยมหาราช' },
    { ...S, branch_id: main.id, holiday_date: '2026-12-07', reason: 'ชดเชยวันพ่อแห่งชาติ' },
  ]), 'holidays');

  const services = must(await db.from('services').select('id,service_name,duration_minutes').eq('shop_id', S.shop_id).eq('is_deleted', false).order('sort_order'), 'services');

  // ── partners ──
  const partners = {};
  for (const [type, list] of [['customer', CUSTOMERS], ['supplier', SUPPLIERS]]) {
    for (const p of list) partners[p.code] = { ...p, type, id: must(await db.from('customers').insert({ ...S, partner_type: type, ...p }).select('id').single(), p.code).id };
  }

  let soSeq = 0; let poSeq = 0;
  /** Create an SO / PO row. */
  async function doc({ type, partner, due, payment = 'paid', status = 'open', i = 0, remark = null }) {
    const docNo = type === 'so' ? `SO-2609${String(++soSeq).padStart(3, '0')}` : `PO-2609${String(++poSeq).padStart(3, '0')}`;
    const its = type === 'po' ? items(CATALOG_PO, i) : [];
    const row = must(await db.from('external_documents').insert({
      ...S, branch_id: main.id, doc_type: type, doc_no: docNo, partner_id: partner.id, partner_code: partner.code, partner_name: partner.full_name,
      doc_date: addDays(due, -3), due_date: due, status, source: 'manual', items: its, total_qty: its.reduce((s, x) => s + x.qty, 0), remark,
      payment_status: type === 'so' ? payment : 'unpaid', payment_updated_at: type === 'so' && payment !== 'unpaid' ? at(addDays(due, -2), '10:00') : null, is_deleted: false,
    }).select('id,doc_no').single(), docNo);
    const t = token('booking', row.id);
    must(await db.from('external_documents').update({ booking_token_hash: sha(t), booking_token_version: 0, booking_token_expires_at: at(addDays(today, 30), '23:59') }).eq('id', row.id), 'link');
    return { ...row, bookUrl: `${APP_URL}/book/${t}`, partner, type };
  }

  /** Queue through the real RPC at a given start (falls back to the next free slot). */
  async function queue(d, date, want, { status = 'confirmed', service = services[rnd(0, 2)], driver = DRIVERS[rnd(0, DRIVERS.length - 1)], source = 'admin' } = {}) {
    const direction = d.type === 'so' ? 'outbound' : 'inbound';
    const slots = must(await db.rpc('get_dock_slots', { p_shop_id: S.shop_id, p_branch_id: main.id, p_direction: direction, p_service_id: service.id, p_date: date }), 'slots')
      .filter((s) => s.remaining_capacity > 0).map((s) => hm(s.slot_time));
    const start = slots.find((s) => s >= want);
    if (!start) return null;
    const n = rnd(0, 8);
    const plate = `${70 + n}-${1000 + rnd(100, 8999)}`;
    const r = must(await db.rpc('create_dock_booking', {
      p_shop_id: S.shop_id, p_branch_id: main.id, p_direction: direction, p_service_id: service.id, p_date: date, p_start: `${start}:00`,
      p_customer_id: d.partner.id, p_plate_number: plate, p_status: status, p_source: source === 'walk_in' ? 'admin' : source, p_resource_id: null, p_document_id: d.id,
      p_driver_name: driver[0], p_driver_phone: driver[1], p_receiver_name: null, p_receiver_phone: null, p_note: null, p_actor: null,
    }), `booking ${d.doc_no}`)[0];
    const b = must(await db.from('bookings').select('id,queue_number,start_time,end_time,service_minutes,resource_name,do_number').eq('id', r.booking_id).single(), 'b');
    if (source !== 'admin') must(await db.from('bookings').update({ booking_source: source }).eq('id', b.id), 'source');
    await db.from('booking_logs').insert({ ...S, booking_id: b.id, action: 'create', description: `สร้างคิว ${b.queue_number}`, to_value: { status }, actor_kind: source === 'customer_link' ? 'customer' : 'staff', created_at: at(addDays(date, -2), '09:30') });
    return { ...b, date, start: hm(b.start_time) };
  }

  /** Move a queue through its lifecycle by writing the timestamps a real day would leave. */
  async function lifecycle(b, to, { arriveOff = 0, wait = 10, overrun = 0 } = {}) {
    const upd = {};
    const arr = at(b.date, b.start, arriveOff);
    if (['checked_in', 'called', 'serving', 'completed', 'late'].includes(to)) Object.assign(upd, to === 'late' ? {} : { arrived_at: arr, checked_in_at: arr });
    if (['called', 'serving', 'completed'].includes(to)) Object.assign(upd, { called_at: at(b.date, b.start, arriveOff + wait), call_count: 1, called_by: staffUser?.id ?? null });
    if (['serving', 'completed'].includes(to)) upd.serving_started_at = at(b.date, b.start, arriveOff + wait + 3);
    if (to === 'completed') upd.completed_at = at(b.date, b.start, arriveOff + wait + 3 + (b.service_minutes ?? 45) + overrun);
    upd.status = to;
    must(await db.from('bookings').update(upd).eq('id', b.id), `lifecycle ${to}`);
    const steps = [['checked_in', 'รถมาถึงแล้ว', upd.checked_in_at], ['called', 'เรียกเข้าท่า', upd.called_at], ['serving', 'เริ่มขึ้น/ลงของ', upd.serving_started_at], ['completed', 'ปิดงาน', upd.completed_at]];
    for (const [st, label, ts] of steps) if (ts) await db.from('booking_logs').insert({ ...S, booking_id: b.id, action: 'status_change', description: label, to_value: { status: st }, actor_kind: 'staff', created_at: ts });
  }

  const pick = (list) => list[rnd(0, list.length - 1)];
  const custList = CUSTOMERS.map((c) => partners[c.code]);
  const supList = SUPPLIERS.map((c) => partners[c.code]);

  // ── history: working days of the last ~4 weeks ──
  const START_TIMES = ['08:00', '08:30', '09:00', '10:00', '10:30', '11:00', '13:00', '13:30', '14:00', '15:00', '15:30'];
  for (let back = 28; back >= 1; back--) {
    const date = addDays(today, -back);
    if ([0, 6].includes(weekday(date))) continue;
    const perDay = rnd(3, 6);
    for (let k = 0; k < perDay; k++) {
      const isPo = rnd(0, 3) === 0;
      const d = await doc({ type: isPo ? 'po' : 'so', partner: isPo ? pick(supList) : pick(custList), due: date, payment: rnd(0, 4) === 0 ? 'credit' : 'paid', i: k });
      const b = await queue(d, date, START_TIMES[rnd(0, START_TIMES.length - 1)]);
      if (!b) continue;
      const roll = rnd(0, 19);
      if (roll === 0) { must(await db.from('bookings').update({ status: 'no_show' }).eq('id', b.id), 'ns'); }
      else if (roll === 1) { must(await db.from('bookings').update({ status: 'cancelled', cancel_reason: 'ลูกค้าขอเลื่อนรับสินค้า' }).eq('id', b.id), 'cx'); }
      else await lifecycle(b, 'completed', { arriveOff: rnd(-15, 25), wait: rnd(3, 25), overrun: rnd(-10, 20) });
      must(await db.from('external_documents').update({ status: roll === 1 ? 'open' : 'completed' }).eq('id', d.id), 'doc st');
    }
  }

  // ── today: one queue per board column ──
  const links = { book: {}, driver: {} };
  const todayPlan = [
    ['08:00', 'completed', 'so'], ['08:30', 'completed', 'po'], ['09:00', 'completed', 'so'], ['10:00', 'completed', 'so'],
    ['11:00', 'no_show', 'so'], ['13:00', 'completed', 'po'], ['13:30', 'serving', 'so'], ['14:00', 'called', 'so'],
    ['14:30', 'checked_in', 'po'], ['15:00', 'checked_in', 'so'], ['15:30', 'late', 'so'], ['16:00', 'confirmed', 'so'], ['16:00', 'confirmed', 'po'],
  ];
  if (![0, 6].includes(weekday(today))) {
    for (const [i, [t, st, type]] of todayPlan.entries()) {
      const d = await doc({ type, partner: type === 'po' ? supList[i % supList.length] : custList[i % custList.length], due: today, i });
      const b = await queue(d, today, t, { service: services[i % 3], driver: DRIVERS[i % DRIVERS.length] });
      if (!b) continue;
      if (st === 'no_show') must(await db.from('bookings').update({ status: 'no_show' }).eq('id', b.id), 'ns');
      else if (st === 'late') must(await db.from('bookings').update({ status: 'late' }).eq('id', b.id), 'late');
      else if (st !== 'confirmed') await lifecycle(b, st, { arriveOff: -5, wait: st === 'called' ? 12 : 8 });
      must(await db.from('external_documents').update({ status: st === 'completed' ? 'completed' : 'booked' }).eq('id', d.id), 'doc st');
      const dt = token('driver', b.id);
      must(await db.from('bookings').update({ driver_token_hash: sha(dt), driver_token_version: 0, driver_token_expires_at: at(addDays(today, 3), '23:59') }).eq('id', b.id), 'dl');
      links.driver[st] = links.driver[st] ?? `${APP_URL}/driver/${dt}`;
    }
    // unpaid SO → pending queue from the customer link
    const du = await doc({ type: 'so', partner: custList[2], due: today, payment: 'unpaid', remark: 'รอยืนยันการโอน' });
    const bu = await queue(du, today, '16:30', { status: 'pending', source: 'customer_link' });
    if (bu) must(await db.from('external_documents').update({ status: 'booked' }).eq('id', du.id), 'doc st');
  }

  // ── future: calendar + pending approvals ──
  for (let ahead = 1; ahead <= 16; ahead++) {
    const date = addDays(today, ahead);
    if ([0, 6].includes(weekday(date)) || ['2026-10-13', '2026-10-23'].includes(date)) continue;
    const perDay = rnd(2, 5);
    for (let k = 0; k < perDay; k++) {
      const isPo = rnd(0, 3) === 0;
      const unpaid = !isPo && rnd(0, 5) === 0;
      const d = await doc({ type: isPo ? 'po' : 'so', partner: isPo ? pick(supList) : pick(custList), due: date, payment: unpaid ? 'unpaid' : 'paid', i: k });
      const b = await queue(d, date, START_TIMES[rnd(0, START_TIMES.length - 1)], { status: unpaid || rnd(0, 3) === 0 ? 'pending' : 'confirmed', source: 'customer_link' });
      if (b) must(await db.from('external_documents').update({ status: 'booked' }).eq('id', d.id), 'doc st');
    }
  }

  // ── open documents without a queue (booking links to send) ──
  const openSo = await doc({ type: 'so', partner: partners.C001, due: addDays(today, 2), payment: 'paid' });
  const openSoUnpaid = await doc({ type: 'so', partner: partners.C004, due: addDays(today, 3), payment: 'unpaid' });
  const openPo = await doc({ type: 'po', partner: partners.V002, due: addDays(today, 2), i: 1 });
  await doc({ type: 'po', partner: partners.V003, due: addDays(today, 4), i: 2 });
  links.book = { so_open: openSo.bookUrl, so_unpaid: openSoUnpaid.bookUrl, po_open: openPo.bookUrl, so_open_no: openSo.doc_no, po_open_no: openPo.doc_no };

  // ── notifications for the bell / notification page ──
  const note = (type, category, priority, title, message, mins) => ({ ...S, branch_id: main.id, type, category, priority, title, message, body: message, metadata: {}, is_read: false, is_archived: false, created_at: new Date(Date.now() - mins * 60_000).toISOString() });
  must(await db.from('notifications').insert([
    note('booking_submitted', 'bookings', 'medium', 'คำขอจองคิวใหม่', `${partners.C003.full_name} จองคิว 16:30 น. รอยืนยัน (ยังไม่ชำระเงิน)`, 12),
    note('booking_arrived', 'operations', 'medium', 'รถมาถึงแล้ว', 'คิว R-010 ทะเบียน 74-2231 เช็คอินที่ประตู', 25),
    note('booking_vehicle_changed', 'bookings', 'high', 'ลูกค้าเปลี่ยนทะเบียนรถ', `${partners.C002.full_name} เปลี่ยนทะเบียนเป็น 71-5520`, 55),
    note('payment_cleared', 'billing', 'medium', 'บันทึกการชำระเงินแล้ว', 'SO อนุมัติคิวได้แล้ว', 90),
    note('booking_walk_in', 'operations', 'medium', 'Walk-in', 'สร้างคิว Walk-in ให้รถที่มาถึงโดยไม่ได้จอง', 180),
  ]), 'notifications');

  // ── a few audit entries for the activity log page ──
  const admin = users.find((u) => /admin@manual/.test(u.email ?? ''));
  if (admin) {
    must(await db.from('activity_logs').insert([
      { ...S, user_id: admin.id, action: 'data_created', target_table: 'booking_resources', payload: { resource_name: 'ท่า L1 (รับ/ส่ง)' }, created_at: at(today, '09:05') },
      { ...S, user_id: admin.id, action: 'data_updated', target_table: 'site_settings', payload: { grace_minutes: 30 }, created_at: at(today, '09:12') },
      { ...S, user_id: admin.id, action: 'role_updated', target_table: 'roles', payload: { code: 'wh_manager' }, created_at: at(today, '09:20') },
      { ...S, user_id: admin.id, action: 'data_created', target_table: 'holidays', payload: { holiday_date: '2026-10-23', reason: 'วันปิยมหาราช' }, created_at: at(today, '09:25') },
    ]), 'activity');
  }

  const out = { today, links };
  if (args.out) fs.writeFileSync(String(args.out), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ today, so: soSeq, po: poSeq, driverStates: Object.keys(links.driver) }, null, 2));
}

main().catch((e) => { console.error('seed failed:', e instanceof Error ? e.message : e); process.exit(1); });
