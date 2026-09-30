/**
 * Shared Playwright helpers for the manual screenshots.
 *
 * Playwright is loaded from the npx cache the proposal capture scripts use
 * (override with PLAYWRIGHT_CORE); nothing is added to package.json.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const PW = process.env.PLAYWRIGHT_CORE || path.join(os.homedir(), '.npm/_npx/bbb8a2c4738e2b0c/node_modules/playwright-core');
export const { chromium } = require(PW);
export const APP_URL = process.env.APP_URL || 'http://localhost:3100';

/** Launch one headless browser for the whole run. */
export async function launch(args = []) {
  return chromium.launch({ headless: true, args });
}

/** Hide the Next.js dev-tools badge so it never shows up in a manual picture. */
async function hideDevOverlay(ctx) {
  await ctx.addInitScript(() => {
    const add = () => {
      const s = document.createElement('style');
      s.textContent = 'nextjs-portal{display:none!important}';
      document.head.appendChild(s);
    };
    if (document.head) add(); else document.addEventListener('DOMContentLoaded', add);
  });
  // `next dev` compiles each route on first hit — be patient.
  ctx.setDefaultNavigationTimeout(120000);
  ctx.setDefaultTimeout(45000);
  return ctx;
}

/** Desktop portal context (1600×1000 @2x, Thai locale, Bangkok time). */
export async function desktop(browser, extra = {}) {
  return hideDevOverlay(await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2, locale: 'th-TH', timezoneId: 'Asia/Bangkok', ...extra }));
}

/** Phone context for the public pages (390×844 @2x). */
export async function phone(browser, extra = {}) {
  return hideDevOverlay(await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['notifications', 'geolocation'], geolocation: { latitude: 13.6012, longitude: 100.8021 }, locale: 'th-TH', timezoneId: 'Asia/Bangkok', ...extra }));
}

/**
 * Log in through the real form. Waits for hydration first — submitting before
 * React attaches sends the form as a GET (see CLAUDE.md E2E notes).
 */
export async function login(page, email, password) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.fill('input[name=email]', email);
    await page.fill('input[name=password]', password);
    await page.click('button[type=submit]');
    try {
      await page.waitForURL(/\/portal/, { timeout: 20000 });
      return;
    } catch (e) {
      if (attempt === 3) throw e;
    }
  }
}

/** Wait until fonts are ready and MUI skeletons / progress spinners are gone. */
export async function settle(page, ms = 600) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => !document.querySelector('.MuiSkeleton-root, .MuiCircularProgress-root, .MuiLinearProgress-root'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

/** Open a portal path and wait for it to settle. */
export async function open(page, p, ms) {
  await page.goto(`${APP_URL}${p}`, { waitUntil: 'domcontentloaded' });
  await settle(page, ms);
}

/**
 * Save a screenshot. `target` may be a locator (element shot) or omitted
 * (viewport shot). Mouse is parked off-canvas so hover states do not leak in.
 */
export async function shot(page, dir, name, target, opts = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.png`);
  if (!opts.keepMouse) await page.mouse.move(1, 1).catch(() => {});
  await page.waitForTimeout(250);
  if (target) await target.screenshot({ path: file, animations: 'disabled' });
  else await page.screenshot({ path: file, animations: 'disabled', fullPage: Boolean(opts.fullPage) });
  console.log('  ✓', path.relative(process.cwd(), file));
  return file;
}
