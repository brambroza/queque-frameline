#!/usr/bin/env node
/**
 * Real end-to-end run of "customer changes the vehicle / driver" against the
 * running dev server and the real Supabase database, capturing PNGs.
 *
 * Uses the seeded E2E set of customer C002 (scripts/dev/seed-test-data.mjs --tag=E2E):
 *   EDIT_DOC  = an SO whose queue is still confirmed  → the customer changes plate + driver
 *   LOCKED_DOC = an SO whose queue is already on site → no "change vehicle" button
 *
 * Usage (dev server on :3000, portal QA user exists):
 *   QA_PASSWORD=… node scripts/dev/e2e-vehicle-change.mjs [--edit=SO-TEST-C002-E2E-003] [--locked=SO-TEST-C002-E2E-001]
 * Output: docs/test-evidence/<date>-vehicle-change/*.png
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const PROJECT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const OUT = path.join(PROJECT, 'docs/test-evidence', `${new Date().toISOString().slice(0, 10)}-vehicle-change`);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const APP = process.env.APP_URL || 'http://localhost:3000';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || path.join(os.homedir(), '.npm/_npx/bbb8a2c4738e2b0c/node_modules/playwright-core'));

const env = {};
for (const line of fs.readFileSync(path.join(PROJECT, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}
const TOKEN_SECRET = env.TOKEN_SECRET || env.SUPABASE_SERVICE_ROLE_KEY;
const QA_EMAIL = process.env.QA_EMAIL || 'qa-driver-test@example.com';
const QA_PASS = process.env.QA_PASSWORD || '';
if (!QA_PASS) { console.error('Set QA_PASSWORD (portal admin password of the QA user, see scripts/create-admin.mjs)'); process.exit(1); }

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const EDIT_DOC = String(args.edit || 'SO-TEST-C002-E2E-003');
const LOCKED_DOC = String(args.locked || 'SO-TEST-C002-E2E-001');
const NEW = { plate: '81-9999', plateNormalized: '819999', driver: 'สมหมาย เปลี่ยนรถ', phone: '0899998888' };

function sql(q) {
  try { return execFileSync('psql', [env.DATABASE_URL, '-Atc', q], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch (e) { throw new Error(`psql failed: ${String(e.stderr || '').trim()}\n${q}`); } // never echo the connection string
}
function log(msg) { console.log(`[${new Date().toTimeString().slice(0, 8)}] ${msg}`); }
const deriveLinkToken = (kind, id, version) => createHmac('sha256', TOKEN_SECRET).update(`${kind}:${id}:${version}`, 'utf8').digest('base64url');

/** Doc + its newest live booking, with derived customer / driver links. */
function loadCase(docNo) {
  const row = sql(`select d.id, d.booking_token_version, b.id, b.queue_number, b.status, b.plate_number, b.driver_name, b.driver_token_version
    from external_documents d join bookings b on b.document_id = d.id and b.is_deleted = false
    where d.doc_no = '${docNo}' order by b.created_at desc limit 1`);
  if (!row) throw new Error(`no booking for ${docNo}`);
  const [docId, docVer, bookingId, queue, status, plate, driver, drvVer] = row.split('|');
  return {
    docNo, queue, status, plate, driver, bookingId,
    customerUrl: `${APP}/book/${deriveLinkToken('booking', docId, Number(docVer))}`,
    driverUrl: `${APP}/driver/${deriveLinkToken('driver', bookingId, Number(drvVer))}`,
  };
}
const EDIT = loadCase(EDIT_DOC);
const LOCKED = loadCase(LOCKED_DOC);
log(`edit: ${EDIT.queue} (${EDIT.status}, ${EDIT.plate}, ${EDIT.driver}) · locked: ${LOCKED.queue} (${LOCKED.status})`);
if (!['pending', 'confirmed', 'late'].includes(EDIT.status)) throw new Error(`${EDIT.queue} is ${EDIT.status} — pick a queue that is still editable (--edit=)`);
if (['pending', 'confirmed', 'late'].includes(LOCKED.status)) throw new Error(`${LOCKED.queue} is ${LOCKED.status} — pick a queue already on site (--locked=)`);

let shotNo = 0;
async function shot(page, name, opts = {}) {
  shotNo += 1;
  const file = path.join(OUT, `${String(shotNo).padStart(2, '0')}-${name}.png`);
  await page.evaluate(() => document.fonts.ready).catch(() => undefined);
  await page.addStyleTag({ content: '.animate-pulse{animation:none!important} nextjs-portal{display:none!important}' }).catch(() => undefined);
  await page.waitForTimeout(300);
  await page.screenshot({ path: file, fullPage: Boolean(opts.fullPage) });
  log(`📸 ${path.relative(PROJECT, file)}`);
}

const browser = await chromium.launch();
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

async function openPublic(url) {
  const page = await mobile.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const el = await page.waitForSelector('article, .text-red-800', { timeout: 180_000 });
  if (!(await page.$('article'))) throw new Error(`public page failed: ${await el.innerText()}`);
  return page;
}

try {
  // ── customer: status page ──
  const c = await openPublic(EDIT.customerUrl);
  const card = c.locator('article', { hasText: EDIT.queue }).first();
  const editBtn = card.getByRole('button', { name: 'เปลี่ยนทะเบียนรถ / คนขับ' });
  await editBtn.waitFor({ timeout: 30_000 });
  await editBtn.scrollIntoViewIfNeeded();
  await shot(c, 'customer-status-page');

  // ── open the inline form ──
  await editBtn.click();
  const form = c.locator('form').filter({ hasText: 'เปลี่ยนรถ / คนขับ' });
  await form.waitFor({ timeout: 15_000 });
  await form.scrollIntoViewIfNeeded();
  await shot(c, 'customer-edit-form');

  // ── invalid plate → client-side error, no API call ──
  const plateInput = form.getByPlaceholder(/เช่น/);
  await plateInput.fill('กข');
  await form.getByRole('button', { name: 'บันทึกและแจ้งคลัง' }).click();
  await c.waitForSelector('text=ทะเบียนไม่ตรงรูปแบบ', { timeout: 10_000 });
  await shot(c, 'customer-edit-invalid-plate');

  // ── fill the new vehicle ──
  await plateInput.fill(NEW.plate);
  await form.getByLabel('ชื่อคนขับ').fill(NEW.driver);
  await form.getByLabel('เบอร์คนขับ').fill(NEW.phone);
  await shot(c, 'customer-edit-filled');

  // ── save → server writes + notifies the warehouse ──
  await form.getByRole('button', { name: 'บันทึกและแจ้งคลัง' }).click();
  await c.waitForSelector('text=แจ้งคลังเรื่องรถ/คนขับ', { timeout: 30_000 });
  await c.evaluate(() => window.scrollTo(0, 0));
  await c.waitForSelector(`text=${NEW.plateNormalized}`, { timeout: 30_000 });
  await shot(c, 'customer-saved');
  await shot(c, 'customer-saved-fullpage', { fullPage: true });
  log(`db: ${sql(`select plate_number||' · '||coalesce(driver_name,'')||' · '||coalesce(driver_phone,'')||' · plate_changed_at='||coalesce(plate_changed_at::text,'null') from bookings where id='${EDIT.bookingId}'`)}`);

  // ── driver page shows the new plate / driver ──
  const d = await openPublic(EDIT.driverUrl);
  await d.waitForSelector(`text=${NEW.plateNormalized}`, { timeout: 30_000 });
  await shot(d, 'driver-page-new-plate');

  // ── portal: notification center, board, booking drawer ──
  const p = await desktop.newPage();
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await p.goto(`${APP}/login`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(1500);
    await p.fill('input[name=email]', QA_EMAIL);
    await p.fill('input[name=password]', QA_PASS);
    await p.click('button[type=submit]');
    const ok = await p.waitForURL(/\/portal/, { timeout: 60_000, waitUntil: 'commit' }).then(() => true).catch(() => false);
    if (ok) break;
    if (attempt === 3) throw new Error('portal login failed');
  }
  await p.goto(`${APP}/portal/notifications`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector(`text=คิว ${EDIT.queue}`, { timeout: 180_000 });
  await shot(p, 'portal-notifications');

  await p.goto(`${APP}/portal/queue-board`, { waitUntil: 'domcontentloaded' });
  const boardCard = p.locator('article', { hasText: EDIT.queue }).first();
  await boardCard.waitFor({ timeout: 180_000 });
  await boardCard.getByText(NEW.plateNormalized).waitFor({ timeout: 30_000 });
  await shot(p, 'portal-board-new-plate');

  await p.goto(`${APP}/portal/bookings`, { waitUntil: 'domcontentloaded' });
  const row = p.locator('tr', { hasText: EDIT.queue }).first();
  await row.waitFor({ timeout: 180_000 });
  await row.click();
  await p.waitForSelector(`text=${NEW.driver}`, { timeout: 30_000 });
  await shot(p, 'portal-booking-drawer');

  // ── customer of a queue already on site: no change button ──
  const l = await openPublic(LOCKED.customerUrl);
  const lockedCard = l.locator('article', { hasText: LOCKED.queue }).first();
  await lockedCard.waitFor({ timeout: 30_000 });
  const hasBtn = await lockedCard.getByRole('button', { name: 'เปลี่ยนทะเบียนรถ / คนขับ' }).count();
  if (hasBtn) throw new Error(`${LOCKED.queue} (${LOCKED.status}) still offers the change button`);
  await lockedCard.scrollIntoViewIfNeeded();
  await shot(l, `customer-${LOCKED.status}-no-edit`);

  log(`booking_logs ${EDIT.queue}:\n   ${sql(`select string_agg(to_char(created_at at time zone 'Asia/Bangkok','HH24:MI')||' '||action||': '||coalesce(description,''), E'\\n   ' order by created_at) from booking_logs where booking_id='${EDIT.bookingId}' and created_at > now() - interval '10 minutes'`)}`);
  log(`notification: ${sql(`select type||' · '||title||' · '||message from notifications where related_id='${EDIT.bookingId}' and type='booking_vehicle_changed' order by created_at desc limit 1`)}`);
  log('DONE');
} finally {
  await browser.close();
}
