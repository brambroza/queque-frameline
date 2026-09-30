#!/usr/bin/env node
/**
 * Screenshots for the per-role user manuals (docs/manuals/screenshots/<role>/).
 *
 * Runs against a dev server backed by the LOCAL Supabase stack seeded with
 * seed_manual_demo.mjs — never against production (it clicks real buttons).
 *
 * Usage:
 *   node docs/manuals/capture_manual.mjs --links=<links.json> [--role=sales,purchasing,...]
 * Env: APP_URL (default http://localhost:3100), MANUAL_PASSWORD, PLAYWRIGHT_CORE.
 * Accounts: <role>@manual.local (created with scripts/create-admin.mjs, see README).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, desktop, phone, login, open, settle, shot, APP_URL } from './capture_lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const PASSWORD = process.env.MANUAL_PASSWORD;
if (!PASSWORD) { console.error('Set MANUAL_PASSWORD'); process.exit(1); }
const LINKS = args.links ? JSON.parse(fs.readFileSync(String(args.links), 'utf8')).links : { book: {}, driver: {} };
const ROLES = String(args.role || 'sales,purchasing,whm,director,admin').split(',');
const ONLY = args.only ? String(args.only).split(',') : null;
const out = (role) => path.join(here, 'screenshots', role);

/** Run one named step; failures are logged so one broken shot does not stop the rest. */
async function step(name, fn) {
  if (ONLY && !ONLY.some((o) => name.startsWith(o))) return;
  try { await fn(); } catch (e) { console.warn(`  ✗ ${name}: ${e instanceof Error ? e.message.split('\n')[0] : e}`); }
}

/** Close any open MUI dialog / menu / drawer with Escape. */
async function dismiss(page) {
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
}

const dialog = (page) => page.locator('.MuiDialog-paper, .MuiDrawer-paper.MuiDrawer-paperAnchorRight').last();

// ───────────────────────── SO / PO (sales, purchasing) ─────────────────────────

async function documentsRole(browser, role, email, docPath, code) {
  const dir = out(role);
  const ctx = await desktop(browser);
  const page = await ctx.newPage();
  await login(page, email, PASSWORD);

  await step('01-home', async () => { await open(page, docPath, 1200); await shot(page, dir, '01-home'); });

  await step('02-add', async () => {
    await open(page, docPath);
    await page.getByRole('button', { name: `เพิ่ม ${code}` }).click();
    const d = dialog(page);
    await d.waitFor();
    await d.getByLabel(/เลขที่/).first().fill(code === 'SO' ? 'SO-2610001' : 'PO-2610001');
    await d.getByLabel(/สาขา \/ คลัง/).click();
    await page.getByRole('option', { name: /บางนา/ }).click();
    await d.getByLabel('วันที่เอกสาร').fill('2026-09-30').catch(() => {});
    await d.getByLabel('กำหนดส่ง').fill('2026-10-02').catch(() => {});
    const partner = d.getByLabel(/^ชื่อ(ลูกค้า|ผู้ขาย|คู่ค้า|Supplier)/).first();
    await partner.pressSequentially(code === 'SO' ? 'สยามเฟอร์' : 'ไทยอลูมิ', { delay: 60 });
    await page.getByRole('option').first().waitFor({ timeout: 8000 });
    await page.getByRole('option').first().click();
    await page.waitForTimeout(400);
    if (code === 'PO') {
            await d.getByLabel('รหัส', { exact: true }).first().fill('RM-AL').catch(() => {});
      await d.getByLabel('ชื่อสินค้า', { exact: true }).first().fill('อลูมิเนียมแท่ง (Billet) 7 นิ้ว').catch(() => {});
      await d.getByLabel('จำนวน', { exact: true }).first().fill('12').catch(() => {});
      await d.getByLabel('หน่วย', { exact: true }).first().fill('T').catch(() => {});
    }
    await shot(page, dir, '02-add', d);
    await dismiss(page);
  });

  if (code === 'SO') {
    await step('03-payment', async () => {
      await open(page, docPath);
      await page.getByRole('button', { name: 'บันทึกชำระเงิน' }).first().click();
      const d = dialog(page); await d.waitFor(); await page.waitForTimeout(500);
      await shot(page, dir, '03-payment', d);
      await dismiss(page);
    });
  }

  await step('04-link', async () => {
    await open(page, docPath);
    await page.getByRole('button', { name: /ส่งลิงก์จอง|ดูลิงก์/ }).first().click();
    const d = dialog(page); await d.waitFor(); await settle(page, 800);
    await shot(page, dir, '04-link', d);
    await dismiss(page);
  });

  await step('05-detail', async () => {
    await open(page, docPath);
    // A document whose queue has been called to a dock today.
    await page.getByPlaceholder(/ค้นหา/).fill(code === 'SO' ? 'SO-2609070' : 'PO-2609028');
    await settle(page, 1000);
    await page.locator('tbody tr').first().locator('button').first().click();
    const d = dialog(page); await d.waitFor(); await settle(page, 800);
    await shot(page, dir, '05-detail', d);
    await dismiss(page);
  });

  await step('06-walkin', async () => {
    await open(page, docPath);
    await page.getByPlaceholder(/ค้นหา/).fill(code === 'SO' ? 'SO-2609107' : 'PO-2609042');
    await settle(page, 1000);
    await page.getByRole('button', { name: 'Walk-in' }).first().click();
    const d = dialog(page); await d.waitFor(); await settle(page, 800);
    await d.getByLabel(/ประเภทรถ/).click().catch(() => {});
    await page.getByRole('option', { name: /6 ล้อ/ }).click().catch(() => {});
    await d.getByLabel('ทะเบียนรถ').fill('70-4521').catch(() => {});
    await d.getByLabel('ชื่อคนขับ').fill('สมหมาย ขับดี').catch(() => {});
    await d.getByLabel('เบอร์คนขับ').fill('0891234567').catch(() => {});
    await settle(page, 1200);
    await shot(page, dir, '06-walkin', d);
    await dismiss(page);
  });

  await step('08-notifications', async () => { await open(page, '/portal/notifications', 800); await shot(page, dir, '08-notifications', null, { fullPage: true }); });

  await step('09-feedback', async () => {
    await open(page, docPath);
    await page.getByRole('button', { name: /แจ้งปัญหา|feedback/i }).first().click();
    const d = dialog(page); await d.waitFor({ timeout: 15000 }); await settle(page, 1200);
    await shot(page, dir, '09-feedback', d);
    await dismiss(page);
  });

  await ctx.close();
}

// ───────────────────────── public: customer booking + driver (phone) ─────────────────────────

async function customerBooking(browser, role, url) {
  if (!url) return;
  const dir = out(role);
  const ctx = await phone(browser);
  const page = await ctx.newPage();
  await step('b1-vehicle', async () => {
    await page.goto(url, { waitUntil: 'networkidle' }); await settle(page, 1200);
    await shot(page, dir, 'b1-vehicle');
  });
  await step('b2-date', async () => {
    await page.locator('button').filter({ hasText: /รถ 6 ล้อ/ }).first().click(); await settle(page, 1000);
    await shot(page, dir, 'b2-date');
  });
  await step('b3-time', async () => {
    await page.locator('button:not([disabled])').filter({ hasText: /ว่าง/ }).first().click(); await settle(page, 1000);
    await shot(page, dir, 'b3-time');
  });
  await step('b4-details', async () => {
    await page.locator('button:not([disabled])').filter({ hasText: /ว่าง/ }).first().click(); await settle(page, 800);
    const inputs = page.locator('input');
    await inputs.nth(0).fill('71-5520'); await inputs.nth(1).fill('มานพ ศรีวิไล'); await inputs.nth(2).fill('0811112208');
    await shot(page, dir, 'b4-details');
  });
  await step('b5-confirm', async () => {
    await page.getByRole('button', { name: 'ถัดไป' }).click(); await settle(page, 800);
    await shot(page, dir, 'b5-confirm');
  });
  await step('b6-done', async () => {
    await page.getByRole('button', { name: /ยืนยันจองคิว/ }).click(); await settle(page, 2000);
    await shot(page, dir, 'b6-done');
  });
  await ctx.close();
}

// ───────────────────────── warehouse manager ─────────────────────────

/** Draw a short scribble inside a signature canvas. */
async function scribble(page, canvas) {
  const box = await canvas.boundingBox();
  if (!box) return;
  const x = box.x + box.width * 0.25; const y = box.y + box.height * 0.55;
  await page.mouse.move(x, y); await page.mouse.down();
  for (let i = 1; i <= 24; i++) await page.mouse.move(x + i * (box.width * 0.02), y + Math.sin(i / 2.2) * box.height * 0.18);
  await page.mouse.up();
}

async function openDrawerFor(page, queueNo) {
  await page.getByPlaceholder(/ค้นหา/).first().fill(queueNo).catch(() => {});
  await settle(page, 800);
  await page.locator('tbody tr').filter({ hasText: queueNo }).first().getByRole('button', { name: 'รายละเอียด' }).click();
  const drawer = page.locator('.MuiDrawer-paper').last();
  await drawer.waitFor(); await settle(page, 900);
  return drawer;
}

async function warehouseManager(browser) {
  const role = 'whm'; const dir = out(role);
  const ctx = await desktop(browser);
  const page = await ctx.newPage();
  await login(page, 'whm@manual.local', PASSWORD);

  await step('01-dashboard', async () => { await open(page, '/portal/dashboard?range=month', 2500); await shot(page, dir, '01-dashboard'); });
  await step('02-dashboard-queues', async () => { await open(page, '/portal/dashboard?range=month&tab=queues', 2500); await shot(page, dir, '02-dashboard-queues'); });
  await step('03-export', async () => {
    await open(page, '/portal/dashboard?range=month', 2000);
    await page.getByRole('button', { name: 'Export' }).click(); await page.waitForTimeout(600);
    await shot(page, dir, '03-export', null, { keepMouse: true });
    await dismiss(page);
  });

  await step('04-bookings', async () => { await open(page, '/portal/bookings', 1200); await shot(page, dir, '04-bookings'); });

  await step('05-approve', async () => {
    await open(page, '/portal/bookings', 800);
    await page.getByRole('button', { name: 'พรุ่งนี้' }).first().click();
    await settle(page, 1200);
    await shot(page, dir, '05a-pending', page.locator('main'));
    await page.getByRole('button', { name: 'อนุมัติคิว + ออก DO' }).first().click();
    const d = dialog(page); await d.waitFor(); await settle(page, 1200);
    await shot(page, dir, '05-approve', d);
    await dismiss(page);
  });

  await step('06-drawer', async () => {
    await open(page, '/portal/bookings', 800);
    const row = page.locator('tbody tr').filter({ hasText: 'กำลังเรียก' }).first();
    await row.getByRole('button', { name: 'รายละเอียด' }).click();
    const drawer = page.locator('.MuiDrawer-paper').last(); await drawer.waitFor(); await settle(page, 900);
    await shot(page, dir, '06-drawer-info', drawer);
    for (const [tab, name] of [['ไทม์ไลน์', '07-drawer-timeline'], ['DO', '08-drawer-do'], ['ลิงก์คนขับ', '09-drawer-driver']]) {
      await drawer.getByRole('tab', { name: tab }).click(); await settle(page, 1200);
      await shot(page, dir, name, drawer);
    }
    await drawer.getByRole('tab', { name: 'ข้อมูล' }).click(); await settle(page, 500);
    await drawer.getByRole('button', { name: 'แก้ทะเบียน' }).click();
    const d = dialog(page); await d.waitFor(); await page.waitForTimeout(500);
    await shot(page, dir, '10-plate', d);
    await dismiss(page);
  });

  await step('11-schedule', async () => {
    await open(page, '/portal/bookings', 800);
    const row = page.locator('tbody tr').filter({ hasText: 'ยืนยันแล้ว' }).first();
    await row.getByRole('button', { name: 'รายละเอียด' }).click();
    const drawer = page.locator('.MuiDrawer-paper').last(); await drawer.waitFor(); await settle(page, 900);
    await drawer.getByRole('button', { name: /จัดตารางคิว/ }).click();
    const d = dialog(page); await d.waitFor(); await settle(page, 1500);
    await shot(page, dir, '11-schedule-grid', d);
    await d.getByRole('button', { name: 'บอร์ด (ลาก)' }).click(); await settle(page, 1000);
    await shot(page, dir, '12-schedule-board', d);
    await d.getByRole('button', { name: 'เลือกช่องเวลา' }).click().catch(() => {});
    await dismiss(page);
  });

  await step('13-board', async () => { await open(page, '/portal/queue-board', 1500); await shot(page, dir, '13-board'); });

  await step('14-complete', async () => {
    await open(page, '/portal/queue-board', 1200);
    await page.getByRole('button', { name: 'ปิดงาน' }).first().click();
    const d = dialog(page); await d.waitFor(); await settle(page, 800);
    const pads = d.locator('canvas');
    for (let i = 0; i < await pads.count(); i++) await scribble(page, pads.nth(i));
    await shot(page, dir, '14-complete', d);
    await dismiss(page);
  });

  await step('15-walkin', async () => {
    await open(page, '/portal/queue-board', 1000);
    await page.getByRole('button', { name: 'Walk-in' }).first().click();
    const d = dialog(page); await d.waitFor(); await settle(page, 1000);
    await shot(page, dir, '15-walkin', d);
    await dismiss(page);
  });

  await step('16-calendar', async () => { await open(page, '/portal/calendar', 1500); await shot(page, dir, '16-calendar'); });
  await step('17-queue-display', async () => { await open(page, '/portal/queue-display', 800); await shot(page, dir, '17-queue-display'); });
  await step('18-tv', async () => {
    const tv = await desktop(browser, { viewport: { width: 1600, height: 900 } });
    const p = await tv.newPage();
    await p.goto(`${APP_URL}/display`, { waitUntil: 'networkidle' }); await settle(p, 2500);
    await shot(p, dir, '18-tv'); await tv.close();
  });

  for (const [p, name] of [['/portal/services', '20-vehicle-types'], ['/portal/resources', '21-docks'], ['/portal/working-hours', '22-working-hours'], ['/portal/holidays', '23-holidays'], ['/portal/partners', '24-partners'], ['/portal/reports', '26-reports']]) {
    await step(name, async () => { await open(page, p, 1500); await shot(page, dir, name, page.locator('main')); });
  }
  await step('25-site-settings', async () => { await open(page, '/portal/site-settings', 1500); await page.locator('main input').first().waitFor(); await settle(page, 1500); await shot(page, dir, '25-site-settings', null, { fullPage: true }); });
  await step('27-dock-add', async () => {
    await open(page, '/portal/resources', 1000);
    await page.getByRole('button', { name: /เพิ่มท่า/ }).click();
    const d = dialog(page); await d.waitFor(); await page.waitForTimeout(600);
    await shot(page, dir, '27-dock-add', d); await dismiss(page);
  });
  await ctx.close();
}

async function driverPhone(browser, role) {
  const dir = out(role);
  const ctx = await phone(browser);
  // Headless Chromium reports notifications as blocked; show the page as a phone that has not been asked yet.
  await ctx.addInitScript(() => { try { Object.defineProperty(Notification, 'permission', { get: () => 'default' }); } catch { /* ignore */ } });
  const page = await ctx.newPage();
  for (const [state, name] of [['confirmed', 'd1-driver-confirmed'], ['checked_in', 'd2-driver-waiting'], ['called', 'd3-driver-called']]) {
    const url = LINKS.driver[state];
    if (!url) continue;
    await step(name, async () => { await page.goto(url, { waitUntil: 'networkidle' }); await settle(page, 1500); await shot(page, dir, name); });
  }
  await ctx.close();
}

// ───────────────────────── director ─────────────────────────

async function director(browser) {
  const role = 'director'; const dir = out(role);
  const ctx = await desktop(browser);
  const page = await ctx.newPage();
  await login(page, 'director@manual.local', PASSWORD);
  await step('01-dashboard', async () => { await open(page, '/portal/dashboard?range=month', 2500); await shot(page, dir, '01-dashboard'); });
  await step('02-dashboard-queues', async () => { await open(page, '/portal/dashboard?range=month&tab=queues', 2500); await shot(page, dir, '02-dashboard-queues'); });
  await step('03-branches', async () => {
    await open(page, '/portal/dashboard?range=month', 2000);
    await page.locator('main [role=combobox]').first().click(); await page.waitForTimeout(700);
    await shot(page, dir, '03-branches', null, { keepMouse: true });
    await dismiss(page);
  });
  await step('04-export', async () => {
    await open(page, '/portal/dashboard?range=month', 2000);
    await page.getByRole('button', { name: 'Export' }).click(); await page.waitForTimeout(600);
    await shot(page, dir, '04-export', null, { keepMouse: true });
    await dismiss(page);
  });
  await step('05-board', async () => { await open(page, '/portal/queue-board', 1500); await shot(page, dir, '05-board'); });
  await step('06-calendar', async () => { await open(page, '/portal/calendar', 1500); await shot(page, dir, '06-calendar'); });
  await step('07-reports', async () => { await open(page, '/portal/reports', 1500); await page.locator('main table').first().waitFor(); await settle(page, 1200); await shot(page, dir, '07-reports'); });
  await ctx.close();
}

// ───────────────────────── admin ─────────────────────────

async function admin(browser) {
  const role = 'admin'; const dir = out(role);
  const ctx = await desktop(browser);
  const page = await ctx.newPage();
  await login(page, 'admin@manual.local', PASSWORD);
  await step('00-login', async () => {
    const c2 = await desktop(browser, { viewport: { width: 1000, height: 600 } }); const p2 = await c2.newPage();
    await p2.goto(`${APP_URL}/login`, { waitUntil: 'networkidle' }); await settle(p2, 1000);
    await shot(p2, dir, '00-login'); await c2.close();
  });
  await step('01-home', async () => { await open(page, '/portal/dashboard?range=month', 2500); await shot(page, dir, '01-home'); });
  await step('02-staff', async () => { await open(page, '/portal/staff', 1200); await shot(page, dir, '02-staff'); });
  await step('03-staff-add', async () => {
    await open(page, '/portal/staff', 1000);
    await page.getByRole('button', { name: /เพิ่มพนักงาน/ }).first().click();
    await page.waitForTimeout(1200);
    await shot(page, dir, '03-staff-add');
  });
  await step('04-roles', async () => {
    await open(page, '/portal/staff', 1000);
    await page.getByRole('tab', { name: 'สิทธิ์และเมนู' }).click(); await settle(page, 1200);
    await shot(page, dir, '04-roles');
    const row = page.locator('tr, .MuiCard-root, .MuiPaper-root').filter({ hasText: 'ผู้จัดการคลัง' }).last();
    await row.getByRole('button', { name: 'แก้ไข' }).click();
    const d = dialog(page); await d.waitFor(); await settle(page, 800);
    await shot(page, dir, '05-role-edit', d);
    await dismiss(page);
  });
  await step('06-branches', async () => { await open(page, '/portal/branches', 1200); await shot(page, dir, '06-branches'); });
  await step('07-branch-edit', async () => {
    await open(page, '/portal/branches', 1000);
    await page.locator('tbody tr').first().locator('button').first().click();
    await page.waitForTimeout(1200);
    await shot(page, dir, '07-branch-edit');
  });
  for (const [p, name, full] of [['/portal/settings', '08-settings', true], ['/portal/site-settings', '09-site-settings', true], ['/portal/line-settings', '10-line-settings', true], ['/portal/api-keys', '11-api-keys', false], ['/portal/translations', '13-translations', false], ['/portal/activity-logs', '14-activity-logs', false]]) {
    await step(name, async () => { await open(page, p, 1500); await page.locator('main input, main table').first().waitFor().catch(() => {}); await settle(page, 1500); await shot(page, dir, name, null, { fullPage: full }); });
  }
  // The ERP page prints its endpoints from the browser origin — show the site's host, not localhost.
  await step('11-api-keys', async () => {
    const host = new URL(process.env.MANUAL_PUBLIC_URL || 'https://queque-frameline.vercel.app').host;
    const b2 = await launch([`--host-resolver-rules=MAP ${host}:80 ${new URL(APP_URL).host}`]);
    try {
      const c2 = await desktop(b2); const p2 = await c2.newPage();
      await p2.goto(`http://${host}/login`, { waitUntil: 'networkidle' }); await p2.waitForTimeout(1500);
      await p2.fill('input[name=email]', 'admin@manual.local'); await p2.fill('input[name=password]', PASSWORD);
      await p2.click('button[type=submit]'); await p2.waitForURL(/\/portal/);
      await p2.goto(`http://${host}/portal/api-keys`, { waitUntil: 'domcontentloaded' }); await settle(p2, 2000);
      await shot(p2, dir, '11-api-keys');
    } finally { await b2.close(); }
  });
  await step('12-api-key-add', async () => {
    await open(page, '/portal/api-keys', 1000);
    await page.getByRole('button', { name: 'สร้าง API key' }).first().click();
    const d = dialog(page); await d.waitFor(); await page.waitForTimeout(600);
    await shot(page, dir, '12-api-key-add', d); await dismiss(page);
  });
  await ctx.close();
}

// ───────────────────────── main ─────────────────────────

const browser = await launch();
try {
  for (const role of ROLES) {
    console.log(`\n== ${role}`);
    if (role === 'sales') {
      await documentsRole(browser, 'sales', 'sales@manual.local', '/portal/sales-orders', 'SO');
      await customerBooking(browser, 'sales', LINKS.book.so_open);
    }
    if (role === 'purchasing') {
      await documentsRole(browser, 'purchasing', 'purchasing@manual.local', '/portal/purchase-orders', 'PO');
      await customerBooking(browser, 'purchasing', LINKS.book.po_open);
    }
    if (role === 'whm') { await warehouseManager(browser); await driverPhone(browser, 'whm'); }
    if (role === 'director') await director(browser);
    if (role === 'admin') await admin(browser);
  }
} finally {
  await browser.close();
}
console.log(`\nเสร็จ — ${APP_URL}`);
