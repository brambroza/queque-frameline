#!/usr/bin/env node
/**
 * Captures the customer's booking-link page (`/book/<token>`) while they change
 * the plate / driver of a confirmed queue: the button under the queue card,
 * the inline form filled in, and the page after saving (warehouse notified).
 *
 * The public API is stubbed with fixture data so the picture is stable and
 * nothing is written to the database; the page itself is the real one from `npm run dev`.
 *
 * Usage (dev server running):
 *   node docs/proposal/capture_vehicle_edit.mjs
 * Env:
 *   APP_URL          base URL, default http://localhost:3000
 *   PLAYWRIGHT_CORE  path to a playwright-core package (default: npx cache 1.49)
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'screenshots');
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const PW = process.env.PLAYWRIGHT_CORE || path.join(os.homedir(), '.npm/_npx/bbb8a2c4738e2b0c/node_modules/playwright-core');

const require = createRequire(import.meta.url);
const { chromium } = require(PW);

/** A well-formed (fake) booking token; the API is intercepted so it never reaches the DB. */
const TOKEN = 'fixture-booking-token-0123456789abcdefghijklmn';

const items = [
  { sku: 'PWD-RAL9016', name: 'ผงสีพ่น ขาว RAL9016', qty: 200, uom: 'KG' },
  { sku: 'HW-BRK-SS', name: 'ขายึดสแตนเลส', qty: 500, uom: 'PCS' },
  { sku: 'GL-6MM-CLR', name: 'กระจกใส 6 มม.', qty: 25, uom: 'SHT' },
];

const booking = (over = {}) => ({
  id: 'fx-b-r003', queue_number: 'R-003', status: 'confirmed', direction: 'outbound', booking_date: '2026-09-25', start_time: '11:00:00', end_time: '12:00:00',
  // plates are stored normalised (no separators) — same as what the real page shows
  resource_name: 'ท่า 1 (รับสินค้า)', plate_number: '721434', plate_number_actual: null, driver_name: 'ประยุทธ์ รถใหญ่', driver_phone: '0811110003',
  receiver_name: 'คุณสมศรี (ฝ่ายรับของ)', receiver_phone: '0899990001', note: null, cancel_reason: null, do_number: 'DO-202609-0015', do_issued_at: '2026-09-24T01:46:00.000Z',
  called_at: null, call_count: 0, services: { service_name: 'รถ 10 ล้อ', plate_format: 'truck' },
  external_documents: { doc_no: 'SO-TEST-C002-003', doc_type: 'so', partner_name: 'บริษัท ทดสอบระบบคิว (C002) จำกัด', items },
  cancellable: true, vehicle_editable: true, driver_url: `${APP_URL}/driver/fixture-driver-token-0123456789abcdefghijklmnop`,
  ...over,
});

const meta = (b) => ({
  data: {
    site: { name: 'Fameline Warehouse', branch: 'คลังบางพลี', phone: '02-123-4567', address: 'บางพลี สมุทรปราการ', logo_url: null },
    document: { doc_no: 'SO-TEST-C002-003', doc_type: 'so', status: 'booked', partner_name: 'บริษัท ทดสอบระบบคิว (C002) จำกัด', due_date: '2026-09-25', remark: null, items },
    payment: { required: true, pending: false },
    direction: 'outbound',
    open: true,
    vehicle_types: [{ id: 'fx-vt-10w', service_name: 'รถ 10 ล้อ', duration_minutes: 60, plate_format: 'truck' }],
    rules: { lead_hours: 2, horizon_days: 14, require_admin_confirm: true, grace_minutes: 30, early_arrival_minutes: 60 },
    today: '2026-09-24',
    line: { liff_id: null, add_friend_url: null, linked_name: null, enabled: false },
    bookings: [b],
  },
});

const NEW = { plate_number: '71-5555', driver_name: 'สมหญิง ขับดี', driver_phone: '0899999999' };

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  let current = booking();
  await page.route(`**/api/public/book/${TOKEN}/meta`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(meta(current)) }));
  await page.route(`**/api/public/book/${TOKEN}/vehicle`, (route) => {
    // Pretend the server accepted the change; the next meta poll shows the new values.
    current = booking({ plate_number: '715555', driver_name: NEW.driver_name, driver_phone: NEW.driver_phone });
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { ok: true, changed: true, plate_number: '715555' } }) });
  });

  await page.goto(`${APP_URL}/book/${TOKEN}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('article', { timeout: 120_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: '.animate-pulse{animation:none!important} nextjs-portal{display:none!important}' });
  await page.waitForTimeout(400);

  const shot = async (file, opts = {}) => {
    const out = path.join(OUT, file);
    await page.screenshot({ path: out, ...opts });
    console.log(path.relative(process.cwd(), out));
  };

  // 1) status page: the queue card with the new button under it
  const button = page.getByRole('button', { name: 'เปลี่ยนทะเบียนรถ / คนขับ' });
  await button.scrollIntoViewIfNeeded();
  await shot('05e-book-vehicle-edit-button.png');

  // 2) form open and filled in
  await button.click();
  await page.waitForSelector('form >> text=เปลี่ยนรถ / คนขับ');
  const form = page.locator('form').filter({ hasText: 'เปลี่ยนรถ / คนขับ' });
  await form.getByPlaceholder(/เช่น/).fill(NEW.plate_number);
  const inputs = form.locator('input');
  await inputs.nth(1).fill(NEW.driver_name);
  await inputs.nth(2).fill(NEW.driver_phone);
  await form.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await shot('05f-book-vehicle-edit-form.png');

  // 3) saved: notice on top, card shows the new plate / driver
  await form.getByRole('button', { name: 'บันทึกและแจ้งคลัง' }).click();
  await page.waitForSelector('text=แจ้งคลังเรื่องรถ/คนขับ', { timeout: 30_000 });
  await page.waitForSelector('text=715555');
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await page.waitForTimeout(300);
  await shot('05g-book-vehicle-edit-done.png');
  await shot('05g-book-vehicle-edit-done-full.png', { fullPage: true });

  await page.close();
} finally {
  await browser.close();
}
