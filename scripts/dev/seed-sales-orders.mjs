#!/usr/bin/env node
/**
 * Seed 5 open Sales Orders (no queue yet) for a test day: five different
 * customers, a mix of payment statuses (paid / unpaid / credit) and of
 * documents with and without item lines. Each SO gets a customer booking link,
 * so the whole flow can be tested from the start: customer books → warehouse
 * records payment → approves → DO → check-in → complete.
 *
 * Usage:
 *   node scripts/dev/seed-sales-orders.mjs [--date=YYYY-MM-DD] [--tag=UAT] [--reset] [--dry-run]
 *
 *   --date     Pickup day written to due_date (default: tomorrow, Bangkok time)
 *   --tag      Tag in the document numbers (SO-SEED-<tag>-nnn); --reset only touches that tag (default: date as YYMMDD)
 *   --reset    Remove documents (and their queues) created earlier by this script for that tag, then seed again
 *   --dry-run  Print the plan, write nothing
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_SHOP_KEY,
 * TOKEN_SECRET and NEXT_PUBLIC_APP_URL from .env / .env.local.
 * Customers are matched by code (SEED-C01 … SEED-C05) and reused on every run.
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

/** Load KEY=VALUE pairs of an env file into process.env without overriding what is already set. */
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
const DRY = Boolean(args['dry-run']);
const RESET = Boolean(args.reset);

// ───────────────────────── helpers (mirror src/lib/tokens.ts) ─────────────────────────

/** HMAC-SHA256(TOKEN_SECRET, kind:id:version) base64url — same as deriveLinkToken(). */
const deriveLinkToken = (kind, id, version) => createHmac('sha256', TOKEN_SECRET).update(`${kind}:${id}:${version}`, 'utf8').digest('base64url');
const hashToken = (token) => createHash('sha256').update(token, 'utf8').digest('hex');
const expiryFromNow = (days) => new Date(Date.now() + days * 86_400_000).toISOString();

/** Bangkok calendar date of a Date. */
function bangkokDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const TODAY = bangkokDate();
const DATE = args.date ? String(args.date) : addDays(TODAY, 1);
if (!/^\d{4}-\d{2}-\d{2}$/.test(DATE)) {
  console.error('--date must be YYYY-MM-DD');
  process.exit(1);
}
const TAG = (args.tag ? String(args.tag) : DATE.slice(2).replace(/-/g, '')).toUpperCase().replace(/[^A-Z0-9]/g, '');
const DOC_PREFIX = `SO-SEED-${TAG}-`;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: globalThis.WebSocket },
});

function must(res, what) {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

// ───────────────────────── fixtures ─────────────────────────

/**
 * Five orders, one customer each. SOs keyed by the sales admin carry no item
 * lines (the portal form has none); the two with items look like an ERP push,
 * so the item-based dock minutes suggestion can be tested too.
 */
const ORDERS = [
  {
    customer: { code: 'SEED-C01', full_name: 'บริษัท สยามอลูมิเนียม เทรดดิ้ง จำกัด', phone: '0820000001', email: 'seed-c01@example.com', address: '88 ถ.บางนา-ตราด กม.12 บางพลี สมุทรปราการ' },
    payment_status: 'paid',
    items: [],
    remark: 'ชำระแล้ว — อนุมัติคิวได้ทันที',
  },
  {
    customer: { code: 'SEED-C02', full_name: 'หจก. รุ่งเรืองกระจกและอลูมิเนียม', phone: '0820000002', email: 'seed-c02@example.com', address: '12/4 ถ.พระราม 2 บางขุนเทียน กรุงเทพฯ' },
    payment_status: 'unpaid',
    items: [],
    remark: 'ยังไม่ชำระ — ทดสอบ payment gate (อนุมัติไม่ได้จนกว่าจะบันทึกชำระ)',
  },
  {
    customer: { code: 'SEED-C03', full_name: 'บริษัท เอเชีย คอนสตรัคชั่น ซัพพลาย จำกัด', phone: '0820000003', email: 'seed-c03@example.com', address: '345 ถ.เทพารักษ์ เมือง สมุทรปราการ' },
    payment_status: 'credit',
    items: [],
    remark: 'ลูกค้าเครดิต — อนุมัติคิวได้โดยไม่ต้องชำระก่อน',
  },
  {
    customer: { code: 'SEED-C04', full_name: 'บริษัท ไทยโปรไฟล์ อินดัสทรี จำกัด', phone: '0820000004', email: 'seed-c04@example.com', address: '9 นิคมอุตสาหกรรมบางปู สมุทรปราการ' },
    payment_status: 'paid',
    items: [
      { sku: 'AL-6063-T5-6M', name: 'อลูมิเนียมเส้น 6063 T5 ยาว 6 ม.', qty: 120, uom: 'PCS' },
      { sku: 'AL-SHEET-1.2', name: 'แผ่นอลูมิเนียม 1.2 มม. 4x8 ฟุต', qty: 40, uom: 'SHT' },
      { sku: 'HW-BRK-SS', name: 'ขายึดสแตนเลส', qty: 500, uom: 'PCS' },
    ],
    remark: 'มีรายการสินค้า 3 รายการ — ทดสอบเวลาแนะนำตามจำนวนรายการ',
  },
  {
    customer: { code: 'SEED-C05', full_name: 'ร้าน ส.เจริญวัสดุก่อสร้าง', phone: '0820000005', email: 'seed-c05@example.com', address: '77 ถ.สุขุมวิท บางปะกง ฉะเชิงเทรา' },
    payment_status: 'unpaid',
    items: [
      { sku: 'PWD-RAL9016', name: 'ผงสีพ่น ขาว RAL9016', qty: 200, uom: 'KG' },
      { sku: 'GL-6MM-CLR', name: 'กระจกใส 6 มม.', qty: 25, uom: 'SHT' },
    ],
    remark: 'ยังไม่ชำระ + มีรายการสินค้า 2 รายการ',
  },
];

const PAYMENT_LABEL = { paid: 'ชำระแล้ว', unpaid: 'ยังไม่ชำระ', credit: 'เครดิต' };

// ───────────────────────── main ─────────────────────────

/** Find the customer by code or create it; returns its id (null in dry-run when it does not exist yet). */
async function ensureCustomer(site, customer) {
  const existing = must(await admin.from('customers').select('id').eq('shop_id', site.shopId).eq('partner_type', 'customer').eq('code', customer.code).eq('is_deleted', false).maybeSingle(), `customer ${customer.code}`);
  if (DRY) return existing?.id ?? null;
  if (existing?.id) {
    must(await admin.from('customers').update({ full_name: customer.full_name, email: customer.email, address: customer.address }).eq('id', existing.id), `update customer ${customer.code}`);
    return existing.id;
  }
  const created = must(await admin.from('customers').insert({ company_id: site.companyId, shop_id: site.shopId, partner_type: 'customer', ...customer }).select('id').single(), `insert customer ${customer.code}`);
  return created.id;
}

/** Remove documents of this tag together with the queues booked against them. */
async function resetTag(site) {
  const oldDocs = must(await admin.from('external_documents').select('id,doc_no').eq('shop_id', site.shopId).eq('doc_type', 'so').like('doc_no', `${DOC_PREFIX}%`), 'old docs');
  if (oldDocs.length === 0) {
    console.log('--reset: ไม่มีข้อมูลทดสอบเดิม');
    return;
  }
  const docIds = oldDocs.map((d) => d.id);
  const oldBookings = must(await admin.from('bookings').select('id').eq('shop_id', site.shopId).in('document_id', docIds), 'old bookings');
  console.log(`--reset: ลบคิว ${oldBookings.length} รายการ + เอกสาร ${oldDocs.length} ใบ (${oldDocs.map((d) => d.doc_no).join(', ')})`);
  if (DRY) return;
  if (oldBookings.length > 0) {
    const bookingIds = oldBookings.map((b) => b.id);
    must(await admin.from('booking_logs').delete().in('booking_id', bookingIds), 'delete booking_logs');
    must(await admin.from('bookings').delete().in('id', bookingIds), 'delete bookings');
  }
  must(await admin.from('external_documents').delete().in('id', docIds), 'delete documents');
}

async function main() {
  const shop = must(await admin.from('shops').select('id,company_id,name').eq('shop_key', SITE_SHOP_KEY).eq('is_deleted', false).maybeSingle(), 'shop');
  if (!shop) throw new Error(`Site "${SITE_SHOP_KEY}" not found — apply migrations first`);
  const site = { shopId: shop.id, companyId: shop.company_id };

  const branch = must(await admin.from('branches').select('id,branch_name,code').eq('shop_id', site.shopId).eq('is_deleted', false).eq('active', true).order('created_at').limit(1).maybeSingle(), 'branch');
  if (!branch) throw new Error('No active branch');

  const settingsRow = must(await admin.from('site_settings').select('booking_token_ttl_days').eq('shop_id', site.shopId).maybeSingle(), 'site_settings');
  const ttlDays = settingsRow?.booking_token_ttl_days ?? 7;

  console.log(`Site: ${shop.name} · สาขา: ${branch.branch_name}${branch.code ? ` (${branch.code})` : ''}`);
  console.log(`วันนัดรับสินค้า: ${DATE} · เลขเอกสาร: ${DOC_PREFIX}001 – ${DOC_PREFIX}${String(ORDERS.length).padStart(3, '0')}`);

  if (RESET) await resetTag(site);

  const results = [];
  for (const [i, order] of ORDERS.entries()) {
    const docNo = `${DOC_PREFIX}${String(i + 1).padStart(3, '0')}`;
    const customerId = await ensureCustomer(site, order.customer);
    const paid = order.payment_status !== 'unpaid';
    let bookingUrl = `${APP_URL}/book/<dry-run>`;

    if (!DRY) {
      // A queue may already hang on this document from an earlier run: keep its status, only refresh the fields.
      const existing = must(await admin.from('external_documents').select('id,status').eq('shop_id', site.shopId).eq('doc_type', 'so').eq('doc_no', docNo).maybeSingle(), `find ${docNo}`);
      if (existing && existing.status !== 'open') {
        console.warn(`  ⚠ ${docNo}: มีอยู่แล้วสถานะ "${existing.status}" — ข้าม (ใช้ --reset เพื่อสร้างใหม่)`);
        results.push({ เอกสาร: docNo, ลูกค้า: order.customer.full_name, รหัส: order.customer.code, ชำระเงิน: '-', รายการ: '-', หมายเหตุ: `ข้าม: สถานะ ${existing.status}`, ลิงก์จอง: '-' });
        continue;
      }
      const payload = {
        company_id: site.companyId, shop_id: site.shopId, branch_id: branch.id, doc_type: 'so', doc_no: docNo,
        partner_id: customerId, partner_code: order.customer.code, partner_name: order.customer.full_name,
        doc_date: TODAY, due_date: DATE, status: 'open', source: 'manual',
        items: order.items, total_qty: order.items.length > 0 ? order.items.reduce((s, it) => s + it.qty, 0) : null,
        remark: order.remark, payment_status: order.payment_status,
        payment_ref: order.payment_status === 'paid' ? `SEED-PAY-${TAG}-${i + 1}` : null,
        payment_updated_at: paid ? new Date().toISOString() : null, is_deleted: false,
      };
      const doc = must(await admin.from('external_documents').upsert(payload, { onConflict: 'shop_id,doc_type,doc_no' }).select('id').single(), `upsert ${docNo}`);
      const token = deriveLinkToken('booking', doc.id, 0);
      must(await admin.from('external_documents').update({ booking_token_hash: hashToken(token), booking_token_version: 0, booking_token_expires_at: expiryFromNow(ttlDays) }).eq('id', doc.id), `booking link ${docNo}`);
      bookingUrl = `${APP_URL}/book/${encodeURIComponent(token)}`;
    }

    results.push({ เอกสาร: docNo, ลูกค้า: order.customer.full_name, รหัส: order.customer.code, ชำระเงิน: PAYMENT_LABEL[order.payment_status], รายการ: order.items.length, หมายเหตุ: order.remark, ลิงก์จอง: bookingUrl });
  }

  console.log('');
  console.table(results.map(({ ลิงก์จอง, หมายเหตุ, ...r }) => r));
  console.log('\nลิงก์จองของลูกค้า (เปิดบนมือถือเพื่อทดสอบ):');
  for (const r of results) {
    if (r.ลิงก์จอง === '-') continue;
    console.log(`\n${r.เอกสาร} · ${r.ชำระเงิน} · ${r.ลูกค้า}`);
    console.log(`  ${r.หมายเหตุ}`);
    console.log(`  ${r.ลิงก์จอง}`);
  }
  console.log(DRY ? '\n(dry-run: ไม่ได้เขียนอะไร)' : `\nเสร็จ — ล้างแล้วสร้างชุดใหม่: node scripts/dev/seed-sales-orders.mjs --tag=${TAG} --reset`);
}

main().catch((e) => {
  console.error('seed failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
