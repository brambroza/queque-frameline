#!/usr/bin/env node
/**
 * Build the per-role user manuals: content.mjs → out/<name>.html → out/<name>.pdf (A4).
 *
 * Usage: node docs/manuals/build_manuals.mjs [--only=<file substring>]
 * PDF is printed with headless Chromium (Playwright from the npx cache, see capture_lib.mjs).
 * Fonts load from Google Fonts, so the machine needs network access.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch } from './capture_lib.mjs';
import { MANUALS } from './content.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'out');
const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7);
const VERSION = 'เวอร์ชัน 1.0 · กันยายน 2026';

/** Go Along chevron mark. */
const logo = (fill) => `<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg"><path fill="${fill}" d="M30 2l12 12-16 16 16 16-12 12L2 30z"/><path fill="${fill}" d="M70 2l28 28-28 28-12-12 16-16-16-16z"/></svg>`;

const footer = (n, total) => `<div class="foot"><div class="bar"><i style="width:${Math.round((n / total) * 100)}%"></i></div><div class="row"><span>${logo('#5cb85c')}Go Along Co., Ltd.</span><span>${String(n).padStart(2, '0')}</span></div></div>`;

/** Cover page in the presentation's split layout. */
function cover(m) {
  return `<section class="page cover"><div class="l">
    <div class="brand">${logo('#5cb85c')}<span>Go Along Co., Ltd.</span></div>
    <p class="eyebrow">User Manual · Fameline Dock Queue</p>
    <p class="title">คู่มือการใช้งาน</p>
    <p class="role">สำหรับ${m.role}</p>
    <div class="rule"></div>
    <p class="sub">ระบบจองคิวรับ–ส่งสินค้าออนไลน์ผ่าน LINE<br>${m.subtitle}</p>
    <div class="meta"><div>จัดทำโดย<b>Go Along Co., Ltd.</b></div><div style="text-align:right">เอกสาร<b>${VERSION}</b></div></div>
  </div><div class="r">${logo('#ffffff')}<div class="co">GO ALONG CO., LTD.</div><div class="th">บริษัท โกอะลอง จำกัด</div><div class="tag">SOFTWARE &amp; MOBILE DEVELOPMENT</div></div></section>`;
}

function toc(m, total) {
  const rows = m.pages.map((p, i) => `<li><span class="n">${String(i + 1).padStart(2, '0')}</span><span class="t">${p.title}</span><span class="p">${i + 3}</span></li>`).join('');
  return `<section class="page"><p class="eyebrow en">Contents</p><h1>สารบัญ</h1><p class="lead">คู่มือการใช้งานสำหรับ${m.role}</p><ul class="toc ${m.pages.length > 15 ? 'dense' : ''}">${rows}</ul>${footer(2, total)}</section>`;
}

const contact = () => `<section class="page contact"><div class="top"><p class="eyebrow">Contact us</p><h1>ติดต่อเรา</h1><div class="rule"></div>
  <dl><dt>อีเมล</dt><dd>info@goalong.co.th</dd><dt>โทรศัพท์</dt><dd>085-608-3298</dd><dt>เว็บไซต์</dt><dd>www.goalong.co.th</dd><dt>ที่อยู่</dt><dd>918/288 หมู่ 10 ต.ในคลองบางปลากด อ.พระสมุทรเจดีย์ จ.สมุทรปราการ 10290</dd><dt>เวลาทำการ</dt><dd>จันทร์–ศุกร์ 08:30–17:30 น.</dd></dl></div>
  <div class="bottom"><div class="brand">${logo('#5cb85c')}<span>Go Along Co., Ltd.</span></div><p><b style="color:#14452f;font-size:13pt">บริษัท โกอะลอง จำกัด</b><br>Software &amp; Mobile Development</p>
  <p>พบปัญหาการใช้งาน แจ้งได้จากปุ่มแจ้งปัญหามุมซ้ายล่างของทุกหน้าในระบบ หรือติดต่อตามช่องทางด้านบนในเวลาทำการ</p></div></section>`;

function render(m) {
  const total = m.pages.length + 3;
  const body = m.pages.map((p, i) => `<section class="page"><p class="eyebrow">${p.eyebrow}</p><h1>${p.title}</h1><p class="lead">${p.lead}</p>${p.html}${footer(i + 3, total)}</section>`).join('\n');
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>คู่มือการใช้งาน — ${m.role}</title><base href="${pathToFileURL(here + '/').href}"><link rel="stylesheet" href="assets/manual.css"></head><body>${cover(m)}${toc(m, total)}${body}${contact()}</body></html>`;
}

fs.mkdirSync(OUT, { recursive: true });
const browser = await launch();
try {
  for (const m of MANUALS) {
    if (only && !m.file.includes(only)) continue;
    const missing = [...render(m).matchAll(/src="(screenshots\/[^"]+)"/g)].map((x) => x[1]).filter((s) => !fs.existsSync(path.join(here, s)));
    if (missing.length) console.warn(`  ⚠ ${m.file}: ไม่มีภาพ ${missing.join(', ')}`);
    const html = path.join(OUT, `${m.file}.html`);
    fs.writeFileSync(html, render(m));
    const page = await browser.newPage();
    await page.goto(pathToFileURL(html).href, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    // A page whose content is taller than A4 would be clipped — report it instead of shipping it.
    const over = await page.evaluate(() => [...document.querySelectorAll('.page')].map((p, i) => {
      const foot = p.querySelector('.foot');
      if (!foot) return 0;
      const limit = foot.getBoundingClientRect().top;
      const last = [...p.children].filter((c) => c !== foot).pop();
      return last && last.getBoundingClientRect().bottom > limit - 4 ? i + 1 : 0;
    }).filter(Boolean));
    if (over.length) console.warn(`  ⚠ ${m.file}: เนื้อหาล้นหน้า ${over.join(', ')}`);
    await page.pdf({ path: path.join(OUT, `${m.file}.pdf`), format: 'A4', printBackground: true, preferCSSPageSize: true });
    await page.close();
    console.log(`✓ ${m.file}.pdf (${m.pages.length + 3} หน้า)`);
  }
} finally {
  await browser.close();
}
