#!/usr/bin/env node
/**
 * Real end-to-end run of the driver alert flow against the running dev server
 * and the real Supabase database, capturing PNGs along the way.
 *
 * Seeds its own set (customer C002, tag E2E) so it never touches queues someone
 * is clicking on in the portal:
 *   A (4 ล้อ)  = the waiting driver     B (6 ล้อ) = occupies A's dock     C (10 ล้อ) = becomes late
 *
 *   1. driver page A (confirmed) — enable phone alerts
 *   2. portal: check in B, call B → A's dock busy; check in A → waits
 *   3. cron tick → A gets "กรุณารอสักครู่" (A moved to 08:00 via SQL so the rule fires now)
 *   4. portal: B start → finish → auto-call A → driver page "เชิญเข้าท่า"
 *   5. C moved to 06:30 via SQL → cron → late → driver page "เลยเวลานัด"
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const PROJECT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const OUT = path.join(PROJECT, 'docs/test-evidence', `${new Date().toISOString().slice(0, 10)}-driver-alerts`);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const APP = 'http://localhost:3000';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(os.homedir(), '.npm/_npx/bbb8a2c4738e2b0c/node_modules/playwright-core'));

const env = {};
for (const line of fs.readFileSync(path.join(PROJECT, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}
const QA_EMAIL = process.env.QA_EMAIL || 'qa-driver-test@example.com';
const QA_PASS = process.env.QA_PASSWORD || '';
if (!QA_PASS) { console.error('Set QA_PASSWORD (portal admin password of qa-driver-test@example.com, see scripts/create-admin.mjs)'); process.exit(1); }
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());

function sql(q) {
  try { return execFileSync('psql', [env.DATABASE_URL, '-Atc', q], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch (e) { throw new Error(`psql failed: ${String(e.stderr || '').trim()}\n${q}`); } // never echo the connection string
}
function log(msg) { console.log(`[${new Date().toTimeString().slice(0, 8)}] ${msg}`); }

// ── seed a private set (today, past slots allowed — only dock D1 is outbound and it is full) ──
const seedOut = execFileSync('node', ['scripts/dev/seed-test-data.mjs', '--code=C002', '--tag=E2E', '--reset', '--json', '--allow-past', `--date=${TODAY}`], { cwd: PROJECT, encoding: 'utf8' });
const seeded = JSON.parse(seedOut.split('__SEED_JSON__')[1].trim());
const [A, B] = seeded;
if (A.queue_number === '-' || B.queue_number === '-') throw new Error(`seed could not place A/B today: ${JSON.stringify(seeded.slice(0, 2))}`);
log(`seeded (today): A=${A.queue_number} ${A.doc_no} ${A.start} (${A.dock}) · B=${B.queue_number} ${B.doc_no} ${B.start} (${B.dock})`);
const tokenOf = (r) => r.driver_url.split('/driver/')[1];
// Always address rows by their test document, never by queue number (someone else's R-001 may exist today).
const byDoc = (r, t = '') => `${t}booking_date='${TODAY}' and ${t}document_id=(select id from external_documents where doc_no='${r.doc_no}')`;

// A at 08:00 on B's dock: already past, so the cron can make it late now and, once checked in, "please wait".
sql(`update bookings a set resource_id = b.resource_id, resource_name = b.resource_name, start_time='08:00', end_time='08:30', grace_deadline=('${TODAY} 08:30+07')::timestamptz
     from bookings b where ${byDoc(A, 'a.')} and ${byDoc(B, 'b.')}`);
log(`test setup: ${A.queue_number} → 08:00 on ${B.dock}`);

async function cron() {
  const res = await fetch(`${APP}/api/cron/auto-call`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET || env.CRON_SECRET}` } });
  const j = await res.json();
  log(`cron → ${res.status} ${JSON.stringify(j)}`);
  return j;
}

let shotNo = 0;
async function shot(page, name) {
  shotNo += 1;
  const file = path.join(OUT, `${String(shotNo).padStart(2, '0')}-${name}.png`);
  await page.evaluate(() => document.fonts.ready).catch(() => undefined);
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => undefined);
  await page.screenshot({ path: file, fullPage: false });
  log(`📸 ${path.relative(PROJECT, file)}`);
}

const browser = await chromium.launch();
const driverCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const portalCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

async function openDriver(row) {
  const page = await driverCtx.newPage();
  // Headless Chromium denies notifications; fake permission + push subscribe so the strip reflects a real phone after the tap.
  await page.addInitScript(() => {
    Object.defineProperty(Notification, 'permission', { get: () => 'granted' });
    Notification.requestPermission = () => Promise.resolve('granted');
    PushManager.prototype.getSubscription = () => Promise.resolve(null);
    PushManager.prototype.subscribe = () => Promise.resolve({
      endpoint: 'https://fcm.googleapis.com/fcm/send/e2e-fixture', unsubscribe: () => Promise.resolve(true),
      toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/e2e-fixture', keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } }),
    });
  });
  await page.goto(`${APP}/driver/${tokenOf(row)}`, { waitUntil: 'domcontentloaded' });
  const ok = await page.waitForSelector('article, .text-red-800', { timeout: 180_000 });
  if (!(await page.$('article'))) throw new Error(`driver page ${row.queue_number}: ${await ok.innerText()}`);
  return page;
}

async function portalAction(page, queue, label) {
  const card = page.locator('article', { hasText: queue }).first();
  await card.waitFor({ timeout: 60_000 });
  await card.getByRole('button', { name: label, exact: true }).click();
  await page.waitForTimeout(1500);
  log(`portal: ${queue} → "${label}"`);
}
const logsOf = (r) => sql(`select string_agg(to_char(l.created_at at time zone 'Asia/Bangkok','HH24:MI')||' '||action||': '||coalesce(description,''), E'\\n   ' order by l.created_at) from booking_logs l join bookings b on b.id=l.booking_id where ${byDoc(r, 'b.')} and l.action <> 'create'`);

try {
  // ── 1. driver A sees the job, enables alerts ──
  const dA = await openDriver(A);
  await shot(dA, `driver-${A.queue_number}-confirmed`);
  await dA.getByRole('button', { name: /เปิดแจ้งเตือน/ }).click();
  await dA.waitForSelector('text=แจ้งเตือนบนมือถือเปิดแล้ว', { timeout: 15_000 });
  await shot(dA, `driver-${A.queue_number}-alerts-enabled`);
  log(`push_subscriptions for ${A.queue_number}: ${sql(`select count(*) from push_subscriptions p join bookings b on b.id=p.booking_id where ${byDoc(A, 'b.')} and p.is_deleted=false`)} (VAPID not configured → POST /push 503, in-page alerts only)`);

  // ── 2. cron: A past grace → late ──
  await cron();
  await dA.waitForSelector('text=เลยเวลานัด', { timeout: 25_000 });
  await shot(dA, `driver-${A.queue_number}-late`);

  // ── 3. portal ──
  const p = await portalCtx.newPage();
  // Dev server: wait for hydration, otherwise the native form submits as GET before React attaches onSubmit.
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await p.goto(`${APP}/login`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(1500);
    await p.fill('input[name=email]', QA_EMAIL);
    await p.fill('input[name=password]', QA_PASS);
    await p.click('button[type=submit]');
    const ok = await p.waitForURL(/\/portal/, { timeout: 60_000, waitUntil: 'commit' }).then(() => true).catch(() => false);
    if (ok) break;
    log(`login attempt ${attempt} did not reach /portal (url=${p.url().replace(/password=[^&]*/, 'password=***')})`);
    if (attempt === 3) throw new Error('portal login failed');
  }
  await p.goto(`${APP}/portal/queue-board`, { waitUntil: 'domcontentloaded' });
  await p.locator('article', { hasText: A.queue_number }).first().waitFor({ timeout: 180_000 });
  await shot(p, `portal-board-${A.queue_number}-late`);

  // B takes the dock; A arrives (late → checked_in) and has to wait
  await portalAction(p, B.queue_number, 'รถมาถึงแล้ว');
  await portalAction(p, B.queue_number, 'เรียกเข้าท่า');
  await portalAction(p, A.queue_number, 'รถมาถึงแล้ว');
  await shot(p, `portal-board-${B.queue_number}-on-dock-${A.queue_number}-waiting`);
  await dA.waitForSelector('text=มาถึงแล้ว · รอเรียก', { timeout: 25_000 });
  await shot(dA, `driver-${A.queue_number}-checked-in`);

  // ── 4. cron: wait notice ──
  const c1 = await cron();
  if (!c1.data?.waited?.includes(A.queue_number)) log(`⚠ cron response did not list ${A.queue_number} in waited — checking DB stamp`);
  await dA.waitForSelector('text=คิวล่าช้ากว่ากำหนด', { timeout: 25_000 });
  await shot(dA, `driver-${A.queue_number}-please-wait`);
  log(`wait_notified_at ${A.queue_number}: ${sql(`select wait_notified_at from bookings where ${byDoc(A)}`)}`);

  // ── 5. dock frees → auto-call A ──
  await portalAction(p, B.queue_number, 'เริ่มขึ้น/ลงของ');
  await portalAction(p, B.queue_number, 'ปิดงาน');
  // Another queue may still hold the dock (e.g. a manual test call by staff). The minute tick times it out
  // (called_timeout_minutes) and then auto-calls A — keep ticking until that happens.
  for (let i = 0; i < 40; i += 1) {
    const isCalled = sql(`select status from bookings where ${byDoc(A)}`) === 'called';
    if (isCalled) break;
    const c = await cron();
    if (c.data?.called?.includes(A.queue_number)) break;
    log(`   dock still busy: ${sql(`select string_agg(queue_number||'='||status, ', ') from bookings where booking_date='${TODAY}' and is_deleted=false and status in ('called','serving') and resource_name='${B.dock}'`)} — retry in 30s`);
    await p.waitForTimeout(30_000);
  }
  await p.locator('article', { hasText: A.queue_number }).first().getByText('เรียกอัตโนมัติ').waitFor({ timeout: 60_000 });
  await shot(p, `portal-board-${A.queue_number}-auto-called`);
  await dA.waitForSelector('text=ถึงคิวของคุณแล้ว', { timeout: 25_000 });
  await shot(dA, `driver-${A.queue_number}-called`);
  log(`booking_logs ${A.queue_number}:\n   ${logsOf(A)}`);
  log(`booking_logs ${B.queue_number}:\n   ${logsOf(B)}`);
  log('DONE');
} finally {
  await browser.close();
}
