#!/usr/bin/env node
/**
 * Captures the driver's phone page (`/driver/<token>`) in the two states the
 * driver is alerted about: called to a dock, and overdue (late).
 *
 * The driver API is stubbed with fixture data so the picture is stable and
 * independent of the database; the page itself is the real one from `npm run dev`.
 *
 * Usage (dev server running):
 *   node docs/proposal/capture_driver.mjs
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
// Real VAPID pair so the browser accepts pushManager.subscribe (the push POST is stubbed).
const { generateVAPIDKeys } = require('web-push');
const VAPID = generateVAPIDKeys();

/** A well-formed (fake) driver token; the API is intercepted so it never reaches the DB. */
const TOKEN = 'fixture-driver-token-0123456789abcdefghijklmnop';

const booking = {
  id: 'fx-b-r003', queue_number: 'R-003', status: 'called', direction: 'outbound', booking_date: '2026-09-24', start_time: '11:00:00', end_time: '12:00:00',
  resource_name: 'ท่า 1 (รับสินค้า)', plate_number: '72-1434', plate_number_actual: null, driver_name: 'ประยุทธ์ รถใหญ่', driver_phone: '0811110003',
  receiver_name: 'คุณสมศรี (ฝ่ายรับของ)', receiver_phone: '0899990001', note: null, cancel_reason: null, do_number: 'DO-202609-0015', do_issued_at: '2026-09-24T01:46:00.000Z',
  called_at: '2026-09-24T04:02:00.000Z', call_count: 1, services: { service_name: 'รถ 10 ล้อ' },
  external_documents: {
    doc_no: 'SO-TEST-C002-003', doc_type: 'so', partner_name: 'บริษัท ทดสอบระบบคิว (C002) จำกัด',
    items: [
      { sku: 'PWD-RAL9016', name: 'ผงสีพ่น ขาว RAL9016', qty: 200, uom: 'KG' },
      { sku: 'HW-BRK-SS', name: 'ขายึดสแตนเลส', qty: 500, uom: 'PCS' },
      { sku: 'GL-6MM-CLR', name: 'กระจกใส 6 มม.', qty: 25, uom: 'SHT' },
    ],
  },
};

const meta = (b, extra = {}) => ({
  data: {
    site: { name: 'Fameline Warehouse', phone: '02-123-4567', address: 'บางพลี สมุทรปราการ' },
    booking: b, today: '2026-09-24', can_self_check_in: false, check_in_requires_location: true, check_in_radius_m: 300,
    early_arrival_minutes: 60, grace_minutes: 30, auto_no_show_after_grace: true,
    push: { enabled: true, public_key: VAPID.publicKey },
    line: { liff_id: null, add_friend_url: null, linked_name: null, enabled: false },
    ...extra,
  },
});

const SHOTS = [
  // Before the driver taps "เปิดแจ้งเตือน": the strip offers phone alerts without LINE.
  { file: '10-driver-called-offer.png', meta: meta(booking), enable: false },
  { file: '10a-driver-called.png', meta: meta(booking), enable: true },
  { file: '10b-driver-called-again.png', meta: meta({ ...booking, call_count: 2 }), enable: true },
  { file: '10c-driver-late.png', meta: meta({ ...booking, status: 'late', resource_name: null, called_at: null, call_count: 0 }, { can_self_check_in: true }), enable: true },
  // Checked in, appointment passed, dock still busy → "please wait" notice.
  { file: '10d-driver-waiting.png', meta: meta({ ...booking, status: 'checked_in', called_at: null, call_count: 0, wait_notified_at: '2026-09-24T04:05:00.000Z' }), enable: true },
];

const browser = await chromium.launch();
try {
  for (const shot of SHOTS) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['notifications'] });
    const page = await context.newPage();
    // Headless Chromium reports notifications as denied and cannot reach a push service;
    // fake both so the strip shows what a real phone shows after the tap.
    await page.addInitScript(() => {
      Object.defineProperty(Notification, 'permission', { get: () => 'granted' });
      Notification.requestPermission = () => Promise.resolve('granted');
      PushManager.prototype.getSubscription = () => Promise.resolve(null);
      PushManager.prototype.subscribe = () => Promise.resolve({
        endpoint: 'https://fcm.googleapis.com/fcm/send/fixture',
        toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/fixture', keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } }),
        unsubscribe: () => Promise.resolve(true),
      });
    });
    await page.route(`**/api/public/driver/${TOKEN}`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(shot.meta) }));
    await page.route(`**/api/public/driver/${TOKEN}/push`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { ok: true } }) }));
    await page.goto(`${APP_URL}/driver/${TOKEN}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('article', { timeout: 120_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: '.animate-pulse{animation:none!important} nextjs-portal{display:none!important}' });
    if (shot.enable) {
      await page.getByRole('button', { name: /เปิดแจ้งเตือน/ }).click();
      await page.waitForSelector('text=แจ้งเตือนบนมือถือเปิดแล้ว', { timeout: 15_000 }).catch(() => undefined);
    }
    await page.waitForTimeout(600);
    const out = path.join(OUT, shot.file);
    await page.screenshot({ path: out, fullPage: false });
    console.log(`${path.relative(process.cwd(), out)}  780x1688px`);
    await context.close();
  }
} finally {
  await browser.close();
}
