#!/usr/bin/env node
/**
 * Seed test data for the dock queue: one customer (code C002) with a paid
 * Sales Order + confirmed queue for EVERY active vehicle type, plus one unpaid
 * SO (pending queue, payment gate) and one open SO without a queue (customer
 * self-booking link). Queues are created through the real `create_dock_booking`
 * RPC, so docks, slots, queue numbers and DO numbers behave exactly like
 * production. Driver links and booking links are issued and printed.
 *
 * Usage:
 *   node scripts/dev/seed-test-data.mjs [--date=YYYY-MM-DD] [--code=C002] [--reset] [--dry-run]
 *
 *   --date     Appointment day (default: today if a working day with free slots, else the next one)
 *   --code     Customer code (default C002)
 *   --reset    Remove queues + documents created earlier by this script for that code, then seed again
 *   --dry-run  Print the plan, write nothing
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_SHOP_KEY,
 * TOKEN_SECRET and NEXT_PUBLIC_APP_URL from .env / .env.local.
 * Test documents are tagged `SO-TEST-<code>-…` so they are easy to find and remove.
 */
import fs from 'fs';
import path from 'path';
import { createHash, createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

try {
  if (typeof globalThis.WebSocket === 'undefined') {
    const wsModule = await import('ws');
    globalThis.WebSocket = wsModule.default;
  }
} catch {
  // Supabase client only needs WebSocket for realtime; ignore.
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvFile(path.resolve(process.cwd(), '.env'));
loadEnvFile(path.resolve(process.cwd(), '.env.local'));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_SHOP_KEY = process.env.SITE_SHOP_KEY || 'fameline';
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
const TOKEN_SECRET = process.env.TOKEN_SECRET || SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));
const CODE = String(args.code || 'C002').toUpperCase();
const DRY = Boolean(args['dry-run']);
const RESET = Boolean(args.reset);
const DOC_PREFIX = `SO-TEST-${CODE}-`;

// ───────────────────────── helpers (mirror src/lib/tokens.ts + driver-link.ts) ─────────────────────────

/** HMAC-SHA256(TOKEN_SECRET, kind:id:version) base64url — same as deriveLinkToken(). */
const deriveLinkToken = (kind, id, version) => createHmac('sha256', TOKEN_SECRET).update(`${kind}:${id}:${version}`, 'utf8').digest('base64url');
const hashToken = (token) => createHash('sha256').update(token, 'utf8').digest('hex');
const driverLinkExpiry = (bookingDate, ttlDays) => new Date(new Date(`${bookingDate}T23:59:59+07:00`).getTime() + ttlDays * 86_400_000).toISOString();
const expiryFromNow = (days) => new Date(Date.now() + days * 86_400_000).toISOString();

/** Bangkok calendar date of a Date. */
function bangkokDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function bangkokTime(d = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}
function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: globalThis.WebSocket },
});

function must(res, what) {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

// ───────────────────────── fixtures ─────────────────────────

const CUSTOMER = {
  code: CODE,
  full_name: `บริษัท ทดสอบระบบคิว (${CODE}) จำกัด`,
  phone: '0890000002',
  email: 'qa-c002@example.com',
  address: '99/9 ถ.บางนา-ตราด กม.18 บางพลี สมุทรปราการ',
};

/** One driver per vehicle type — different phones so LINE / push bindings never collide. */
const DRIVERS = [
  { name: 'สมชาย ใจดี', phone: '0811110001' },
  { name: 'วิชัย ขับดี', phone: '0811110002' },
  { name: 'ประยุทธ์ รถใหญ่', phone: '0811110003' },
  { name: 'อนันต์ เทรลเลอร์', phone: '0811110004' },
  { name: 'สุรชัย ตรงเวลา', phone: '0811110005' },
  { name: 'ธนา ขยัน', phone: '0811110006' },
];

/** Plates that satisfy any plate_format: truck style "70-1234" and car style "1กข 1234". */
function plateFor(index, plateFormat) {
  if (plateFormat === 'car') return `${1 + (index % 9)}กข ${1000 + index * 111}`;
  return `${70 + index}-${1234 + index * 100}`;
}

/** 2–4 item lines so the item-based dock minutes suggestion has something to work with. */
function itemsFor(index) {
  const catalog = [
    { sku: 'AL-6063-T5-6M', name: 'อลูมิเนียมเส้น 6063 T5 ยาว 6 ม.', qty: 120, uom: 'PCS' },
    { sku: 'AL-SHEET-1.2', name: 'แผ่นอลูมิเนียม 1.2 มม. 4x8 ฟุต', qty: 40, uom: 'SHT' },
    { sku: 'PWD-RAL9016', name: 'ผงสีพ่น ขาว RAL9016', qty: 200, uom: 'KG' },
    { sku: 'HW-BRK-SS', name: 'ขายึดสแตนเลส', qty: 500, uom: 'PCS' },
    { sku: 'GL-6MM-CLR', name: 'กระจกใส 6 มม.', qty: 25, uom: 'SHT' },
    { sku: 'PK-CRATE-L', name: 'ลังไม้ขนส่ง ขนาด L', qty: 8, uom: 'PCS' },
  ];
  const n = 2 + (index % 3);
  return Array.from({ length: n }, (_, i) => catalog[(index + i) % catalog.length]);
}

// ───────────────────────── main ─────────────────────────

async function main() {
  const shop = must(await admin.from('shops').select('id,company_id,name').eq('shop_key', SITE_SHOP_KEY).eq('is_deleted', false).maybeSingle(), 'shop');
  if (!shop) throw new Error(`Site "${SITE_SHOP_KEY}" not found — apply migrations first`);
  const site = { shopId: shop.id, companyId: shop.company_id };

  const branch = must(await admin.from('branches').select('id,branch_name,code').eq('shop_id', site.shopId).eq('is_deleted', false).eq('active', true).order('created_at').limit(1).maybeSingle(), 'branch');
  if (!branch) throw new Error('No active branch');

  const services = must(await admin.from('services').select('id,service_name,duration_minutes,buffer_minutes,plate_format,sort_order,direction').eq('shop_id', site.shopId).eq('is_deleted', false).eq('active', true).order('sort_order'), 'services')
    .filter((s) => !s.direction || s.direction === 'outbound');
  if (services.length === 0) throw new Error('No active vehicle types (services)');

  const settingsRow = must(await admin.from('site_settings').select('grace_minutes,driver_token_ttl_days,booking_token_ttl_days').eq('shop_id', site.shopId).maybeSingle(), 'site_settings');
  const settings = { grace_minutes: 30, driver_token_ttl_days: 3, booking_token_ttl_days: 7, ...(settingsRow ?? {}) };

  console.log(`Site: ${shop.name} · สาขา: ${branch.branch_name}${branch.code ? ` (${branch.code})` : ''}`);
  console.log(`ประเภทรถ (${services.length}): ${services.map((s) => `${s.service_name} ${s.duration_minutes}′`).join(' · ')}`);

  // ── reset earlier test data of this code ──
  if (RESET) {
    const oldDocs = must(await admin.from('external_documents').select('id,doc_no').eq('shop_id', site.shopId).like('doc_no', `${DOC_PREFIX}%`), 'old docs');
    if (oldDocs.length > 0) {
      const docIds = oldDocs.map((d) => d.id);
      const oldBookings = must(await admin.from('bookings').select('id,queue_number').eq('shop_id', site.shopId).in('document_id', docIds), 'old bookings');
      console.log(`--reset: ลบคิว ${oldBookings.length} รายการ + เอกสาร ${oldDocs.length} ใบ (${oldDocs.map((d) => d.doc_no).join(', ')})`);
      if (!DRY && oldBookings.length > 0) {
        const bookingIds = oldBookings.map((b) => b.id);
        must(await admin.from('booking_logs').delete().in('booking_id', bookingIds), 'delete booking_logs');
        must(await admin.from('bookings').delete().in('id', bookingIds), 'delete bookings');
      }
      if (!DRY) must(await admin.from('external_documents').delete().in('id', docIds), 'delete documents');
    } else {
      console.log('--reset: ไม่มีข้อมูลทดสอบเดิม');
    }
  }

  // ── customer C002 ──
  const existingCustomer = must(await admin.from('customers').select('id').eq('shop_id', site.shopId).eq('partner_type', 'customer').eq('code', CODE).eq('is_deleted', false).maybeSingle(), 'customer');
  let customerId = existingCustomer?.id ?? null;
  if (DRY) {
    console.log(`ลูกค้า ${CODE}: ${customerId ? 'มีอยู่แล้ว' : 'จะสร้างใหม่'} — ${CUSTOMER.full_name}`);
  } else if (customerId) {
    must(await admin.from('customers').update({ full_name: CUSTOMER.full_name, phone: CUSTOMER.phone, email: CUSTOMER.email, address: CUSTOMER.address }).eq('id', customerId), 'update customer');
  } else {
    const created = must(await admin.from('customers').insert({ company_id: site.companyId, shop_id: site.shopId, partner_type: 'customer', ...CUSTOMER }).select('id').single(), 'insert customer');
    customerId = created.id;
  }
  console.log(`ลูกค้า: ${CUSTOMER.full_name} [${CODE}] ${customerId ?? '(dry-run)'}`);

  // ── pick the appointment day ──
  const today = bangkokDate();
  const nowHHMM = bangkokTime();
  const outboundService = services[0];
  let date = args.date ? String(args.date) : null;
  if (!date) {
    const days = must(await admin.rpc('get_available_days', { p_shop_id: site.shopId, p_branch_id: branch.id, p_direction: 'outbound', p_service_id: outboundService.id, p_from: today, p_to: addDays(today, 14), p_not_before: new Date(Date.now() + 15 * 60_000).toISOString() }), 'get_available_days');
    const first = days.find((d) => d.open_slots >= services.length + 1);
    if (!first) throw new Error('ไม่มีวันที่มีช่องว่างพอใน 14 วันข้างหน้า — ระบุ --date เอง');
    date = String(first.day);
  }
  console.log(`วันนัด: ${date}${date === today ? ` (วันนี้ ${nowHHMM} น.)` : ''}`);

  // ── documents + queues ──
  const results = [];
  let docSeq = 0;
  const nextDocNo = () => `${DOC_PREFIX}${String(++docSeq).padStart(3, '0')}`;

  async function upsertDocument({ docNo, paymentStatus, items, remark }) {
    if (DRY) return { id: `dry-${docNo}`, doc_no: docNo };
    const payload = {
      company_id: site.companyId, shop_id: site.shopId, branch_id: branch.id, doc_type: 'so', doc_no: docNo,
      partner_id: customerId, partner_code: CODE, partner_name: CUSTOMER.full_name,
      doc_date: today, due_date: date, status: 'open', source: 'manual', items, total_qty: items.reduce((s, i) => s + i.qty, 0),
      remark, payment_status: paymentStatus, payment_ref: paymentStatus === 'paid' ? `TEST-PAY-${docSeq}` : null,
      payment_updated_at: paymentStatus === 'paid' ? new Date().toISOString() : null, is_deleted: false,
    };
    return must(await admin.from('external_documents').upsert(payload, { onConflict: 'shop_id,doc_type,doc_no' }).select('id,doc_no').single(), `upsert ${docNo}`);
  }

  async function issueBookingLink(doc) {
    if (DRY) return `${APP_URL}/book/<dry-run>`;
    const token = deriveLinkToken('booking', doc.id, 0);
    must(await admin.from('external_documents').update({ booking_token_hash: hashToken(token), booking_token_version: 0, booking_token_expires_at: expiryFromNow(settings.booking_token_ttl_days) }).eq('id', doc.id), 'booking link');
    return `${APP_URL}/book/${encodeURIComponent(token)}`;
  }

  async function issueDriverLink(bookingId) {
    if (DRY) return `${APP_URL}/driver/<dry-run>`;
    const token = deriveLinkToken('driver', bookingId, 0);
    must(await admin.from('bookings').update({ driver_token_hash: hashToken(token), driver_token_version: 0, driver_token_expires_at: driverLinkExpiry(date, settings.driver_token_ttl_days) }).eq('id', bookingId), 'driver link');
    return `${APP_URL}/driver/${encodeURIComponent(token)}`;
  }

  async function firstFreeSlot(service) {
    const slots = must(await admin.rpc('get_dock_slots', { p_shop_id: site.shopId, p_branch_id: branch.id, p_direction: 'outbound', p_service_id: service.id, p_date: date }), 'get_dock_slots');
    const free = slots.filter((s) => s.remaining_capacity > 0).map((s) => String(s.slot_time).slice(0, 5));
    // Today: only slots at least 15 minutes ahead so check-in / auto-call can be exercised.
    const usable = date === today ? free.filter((t) => t > bangkokTime(new Date(Date.now() + 15 * 60_000))) : free;
    return usable[0] ?? null;
  }

  async function createQueue({ service, doc, status, driver, index, note }) {
    const start = await firstFreeSlot(service);
    if (!start) { console.warn(`  ⚠ ${service.service_name}: ไม่มีช่องว่างวันที่ ${date} — ข้าม`); return null; }
    const plate = plateFor(index, service.plate_format);
    if (DRY) return { queue_number: `R-?`, start, plate, do_number: status === 'confirmed' ? 'DO-?' : null, resource_name: '?', driverUrl: `${APP_URL}/driver/<dry-run>` };
    const rows = must(await admin.rpc('create_dock_booking', {
      p_shop_id: site.shopId, p_branch_id: branch.id, p_direction: 'outbound', p_service_id: service.id, p_date: date, p_start: `${start}:00`,
      p_customer_id: customerId, p_plate_number: plate, p_status: status, p_source: 'admin', p_resource_id: null, p_document_id: doc.id,
      p_driver_name: driver.name, p_driver_phone: driver.phone, p_receiver_name: 'คุณสมศรี (ฝ่ายรับของ)', p_receiver_phone: '0899990001',
      p_note: note, p_actor: null,
    }), `create_dock_booking ${doc.doc_no}`);
    const created = rows?.[0];
    if (!created) throw new Error(`create_dock_booking returned nothing for ${doc.doc_no}`);
    const dock = must(await admin.from('bookings').select('resource_name').eq('id', created.booking_id).single(), 'dock name');
    const driverUrl = status === 'confirmed' ? await issueDriverLink(created.booking_id) : null;
    must(await admin.from('booking_logs').insert({
      company_id: site.companyId, shop_id: site.shopId, booking_id: created.booking_id, action: 'create',
      description: `Seed ${created.queue_number}${created.do_number ? ` · ${created.do_number}` : ''} (scripts/dev/seed-test-data.mjs)`,
      to_value: { status, queue_number: created.queue_number, do_number: created.do_number, seed: true }, actor_kind: 'system',
    }), 'booking log');
    return { queue_number: created.queue_number, start, plate, do_number: created.do_number, resource_name: dock.resource_name, driverUrl };
  }

  // 1) Every vehicle type: paid SO → confirmed queue + DO + driver link.
  for (const [i, service] of services.entries()) {
    const docNo = nextDocNo();
    const doc = await upsertDocument({ docNo, paymentStatus: 'paid', items: itemsFor(i), remark: `ทดสอบ ${service.service_name}` });
    const bookingUrl = await issueBookingLink(doc);
    const q = await createQueue({ service, doc, status: 'confirmed', driver: DRIVERS[i % DRIVERS.length], index: i, note: `seed: ${service.service_name}` });
    results.push({ กรณี: 'ชำระแล้ว → ยืนยัน', ประเภทรถ: service.service_name, เอกสาร: docNo, คิว: q?.queue_number ?? '-', เวลา: q?.start ?? '-', ท่า: q?.resource_name ?? '-', DO: q?.do_number ?? '-', ทะเบียน: q?.plate ?? '-', คนขับ: DRIVERS[i % DRIVERS.length].name, ลิงก์คนขับ: q?.driverUrl ?? '-', ลิงก์จอง: bookingUrl });
  }

  // 2) Unpaid SO → pending queue (payment gate blocks approval until paid).
  {
    const service = services[Math.min(1, services.length - 1)];
    const docNo = nextDocNo();
    const doc = await upsertDocument({ docNo, paymentStatus: 'unpaid', items: itemsFor(services.length), remark: 'ทดสอบ payment gate — ยังไม่ชำระ' });
    const bookingUrl = await issueBookingLink(doc);
    const q = await createQueue({ service, doc, status: 'pending', driver: DRIVERS[services.length % DRIVERS.length], index: services.length, note: 'seed: SO ยังไม่ชำระ' });
    results.push({ กรณี: 'ยังไม่ชำระ → รอยืนยัน', ประเภทรถ: service.service_name, เอกสาร: docNo, คิว: q?.queue_number ?? '-', เวลา: q?.start ?? '-', ท่า: q?.resource_name ?? '-', DO: '-', ทะเบียน: q?.plate ?? '-', คนขับ: DRIVERS[services.length % DRIVERS.length].name, ลิงก์คนขับ: '-', ลิงก์จอง: bookingUrl });
  }

  // 3) Open paid SO without a queue: customer books through the link.
  {
    const docNo = nextDocNo();
    const doc = await upsertDocument({ docNo, paymentStatus: 'paid', items: itemsFor(services.length + 1), remark: 'ทดสอบลูกค้าจองเองผ่านลิงก์' });
    const bookingUrl = await issueBookingLink(doc);
    results.push({ กรณี: 'ยังไม่จอง (ลูกค้าจองเอง)', ประเภทรถ: 'ลูกค้าเลือกเอง', เอกสาร: docNo, คิว: '-', เวลา: '-', ท่า: '-', DO: '-', ทะเบียน: '-', คนขับ: '-', ลิงก์คนขับ: '-', ลิงก์จอง: bookingUrl });
  }

  console.log('');
  console.table(results.map(({ ลิงก์คนขับ, ลิงก์จอง, ...r }) => r));
  console.log('\nลิงก์ (เปิดบนมือถือเพื่อทดสอบ):');
  for (const r of results) {
    console.log(`\n${r.เอกสาร} · ${r.กรณี} · ${r.ประเภทรถ}`);
    console.log(`  ลูกค้า: ${r.ลิงก์จอง}`);
    if (r.ลิงก์คนขับ !== '-') console.log(`  คนขับ: ${r.ลิงก์คนขับ}`);
  }
  console.log(DRY ? '\n(dry-run: ไม่ได้เขียนอะไร)' : `\nเสร็จ — ล้างแล้วสร้างชุดใหม่: node scripts/dev/seed-test-data.mjs --code=${CODE} --reset`);
}

main().catch((e) => {
  console.error('seed failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
