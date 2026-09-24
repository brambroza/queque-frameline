#!/usr/bin/env node
/**
 * Captures the yard TV (`/display`) for the proposal at 1600x900 @2x.
 *
 * The display feed is stubbed with fixture data so the picture is the same
 * every time and does not depend on what is in the database today. The page
 * itself is the real one served by `npm run dev`.
 *
 * Usage (dev server running):
 *   node docs/proposal/capture_display.mjs
 * Env:
 *   APP_URL          base URL, default http://localhost:3000
 *   DISPLAY_KEY      appended as ?key= when the site enforces one
 *   PLAYWRIGHT_CORE  path to a playwright-core package (default: npx cache 1.49)
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'screenshots');
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const KEY = process.env.DISPLAY_KEY ? `?key=${encodeURIComponent(process.env.DISPLAY_KEY)}` : '';
const PW = process.env.PLAYWRIGHT_CORE || path.join(os.homedir(), '.npm/_npx/bbb8a2c4738e2b0c/node_modules/playwright-core');

const require = createRequire(import.meta.url);
const { chromium } = require(PW);

/** Queue rows as `/api/public/display` returns them. */
const R001 = {
  id: 'fx-r001', queue_number: 'R-001', status: 'called', direction: 'outbound', start_time: '14:30:00', plate: '70-2585',
  do_number: 'DO-202609-0012', called_at: '2026-09-23T08:57:00.000Z', call_count: 1, dock_id: 'fx-dock-1',
  service_name: 'รถ 10 ล้อ', doc_no: 'DEMO-SO-2609006', doc_type: 'so', customer_name: 'Go Along', driver_name: 'N',
};
const R002 = {
  id: 'fx-r002', queue_number: 'R-002', status: 'checked_in', direction: 'outbound', start_time: '16:00:00', plate: '555',
  do_number: 'DO-202609-0013', called_at: null, call_count: 0, dock_id: null,
  service_name: 'รถ 6 ล้อ', doc_no: 'SO-00003', doc_type: 'so', customer_name: 'Go Along', driver_name: 'Win',
};
const dock = (current) => ({ id: 'fx-dock-1', code: 'D1', name: 'ท่า 1 (รับสินค้า)', direction: 'outbound', current });
const feed = (docks, waiting) => ({
  data: { site: { name: 'Fameline Warehouse', logo_url: null }, today: '2026-09-23', server_time: new Date().toISOString(), docks, waiting },
});

const SHOTS = [
  { file: '09-display-tv.png', feed: feed([dock(R001)], [R002]) },
  { file: '09b-display-tv-waiting.png', feed: feed([dock(null)], [{ ...R001, status: 'checked_in', dock_id: null, called_at: null, call_count: 0 }]) },
];

const browser = await chromium.launch();
try {
  for (const shot of SHOTS) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
    await page.route('**/api/public/display*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(shot.feed) }));
    await page.goto(`${APP_URL}/display${KEY}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('svg[data-yard]', { timeout: 120_000 });
    await page.evaluate(() => document.fonts.ready);
    // the calling tile pulses; hold opacity so the frame is not caught mid-fade
    await page.addStyleTag({ content: '.animate-pulse{animation:none!important} nextjs-portal{display:none!important}' });
    const out = path.join(OUT, shot.file);
    await page.screenshot({ path: out, fullPage: false });
    console.log(`${path.relative(process.cwd(), out)}  3200x1800px`);
    await page.close();
  }
} finally {
  await browser.close();
}
