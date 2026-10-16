#!/usr/bin/env node
/**
 * Build the per-role user manuals as Word files: content.mjs → out/<name>.docx (A4).
 *
 * Usage: node docs/manuals/build_docx.mjs [--only=<file substring>]
 * Needs the `docx` and `cheerio` packages. They are resolved from DOCX_LIB_DIR
 * (a folder that has node_modules/docx and node_modules/cheerio) or from the
 * project's node_modules; nothing is added to package.json.
 *
 * The HTML vocabulary of content.mjs is small (steps / note / warn / fig / table /
 * cards / h2 / b / span.k / p.cap / div flex rows), so each element maps to one
 * docx construct. Layout follows the PDF: cover, contents, one section per page,
 * contact page.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { MANUALS } from './content.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'out');
const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7);
const VERSION = 'เวอร์ชัน 1.2 · ตุลาคม 2026';

const libDir = process.env.DOCX_LIB_DIR || path.resolve(here, '../..');
const require = createRequire(path.join(libDir, 'package.json'));
const docx = require('docx');
const cheerio = require('cheerio');
// sharp (a project dependency) crops the "crop" / clipped figures the way the PDF's CSS does.
const sharp = createRequire(path.join(path.resolve(here, '../..'), 'package.json'))('sharp');
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType,
  HeadingLevel, BorderStyle, ShadingType, LevelFormat, PageBreak, PageNumber, Footer, Header, TabStopType,
  VerticalAlign, TableLayoutType, Bookmark, InternalHyperlink,
} = docx;

/** Each numbered step list restarts at 1: docx numbering instances are per list. */
let stepInstance = 0;

// ───────────────────────── style constants ─────────────────────────

const FONT = 'IBM Plex Sans Thai';
const GREEN_900 = '14452F';
const GREEN_700 = '1D5A3F';
const GREEN_400 = '5CB85C';
const TINT = 'F0F5F2';
const LINE = 'DDE3DF';
const MUTED = '5B6660';
const WARN = 'B26A00';
const WARN_BG = 'FFF7E6';

// A4 with 16 mm side margins → usable width in DXA (1 mm = 56.7 DXA).
const MM = 56.7;
const PAGE_W = Math.round(210 * MM);
const PAGE_H = Math.round(297 * MM);
const MARGIN = Math.round(16 * MM);
const CONTENT_W = PAGE_W - 2 * MARGIN;
// Image sizes are in pixels at 96 dpi for docx-js; 1 mm = 3.78 px.
const PX = 3.7795;
const CONTENT_PX = Math.round(178 * PX);

const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder };
const thinBottom = { style: BorderStyle.SINGLE, size: 4, color: LINE };

/** Read width/height from a PNG header. */
function pngSize(file) {
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(24);
  fs.readSync(fd, buf, 0, 24, 0);
  fs.closeSync(fd);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Fit an image into a box (px), keeping its aspect ratio. */
function fit(size, maxW, maxH) {
  const r = Math.min(maxW / size.width, maxH / size.height, 1);
  return { width: Math.round(size.width * r), height: Math.round(size.height * r) };
}

// ───────────────────────── inline text ─────────────────────────

/** Inline nodes (text, <b>, <span class="k">, <br>) → TextRuns. */
function runs($, node, base = {}) {
  const out = [];
  for (const child of node.contents()) {
    if (child.type === 'text') {
      const text = child.data.replace(/\s+/g, ' ');
      if (text) out.push(new TextRun({ text, ...base }));
    } else if (child.type === 'tag') {
      const el = $(child);
      if (child.name === 'br') out.push(new TextRun({ break: 1 }));
      else if (child.name === 'b' || child.name === 'strong') out.push(...runs($, el, { ...base, bold: true }));
      else if (child.name === 'span' && el.hasClass('k')) out.push(new TextRun({ text: ` ${el.text().trim()} `, bold: true, shading: { type: ShadingType.CLEAR, fill: 'FFFFFF' }, border: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 1 }, ...base }));
      else out.push(...runs($, el, base));
    }
  }
  return out;
}

/** Empty paragraph that keeps two tables apart; dropped when it would end a section. */
const SPACERS = new WeakSet();
const spacer = (after = 60) => { const p = new Paragraph({ spacing: { after } }); SPACERS.add(p); return p; };

const text = (t, opts = {}) => new Paragraph({ children: [new TextRun({ text: t, ...opts })], spacing: { after: 100 } });

// ───────────────────────── block elements ─────────────────────────

function stepsBlock($, ol) {
  const instance = stepInstance++;
  return ol.children('li').map((i, li) => new Paragraph({
    numbering: { reference: 'steps', level: 0, instance },
    spacing: { after: 90 },
    children: runs($, $(li)),
  })).get();
}

function noteBlock($, div, warn) {
  const label = div.children('b').first().text().trim();
  const body = div.clone();
  body.children('b').first().remove();
  // Drop the " · " separator that follows the label in the HTML.
  const firstText = body.contents().get().find((n) => n.type === 'text' && n.data.trim());
  if (firstText) firstText.data = firstText.data.replace(/^\s*·\s*/, '');
  const children = [new TextRun({ text: `${label}  `, bold: true, color: warn ? WARN : GREEN_900 }), ...runs($, body)];
  const para = new Paragraph({ children, spacing: { before: 60, after: 60 } });
  return [new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    layout: TableLayoutType.FIXED,
    borders: { ...noBorders, left: { style: BorderStyle.SINGLE, size: 24, color: warn ? WARN : GREEN_900 } },
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({
      width: { size: CONTENT_W, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: warn ? WARN_BG : TINT, color: 'auto' },
      margins: { top: 80, bottom: 80, left: 160, right: 160 },
      children: [para],
    })] })],
  }), spacer(60)];
}

/**
 * Figures. The PDF shows a picture inside a box of `max-height` mm: `dialog`
 * scales it down, every other kind keeps the width and clips the bottom
 * (`.clip`). Word cannot clip, so clipped pictures are cropped with sharp first.
 */
async function imageParas(div) {
  const files = div.find('img').map((i, img) => img.attribs.src).get();
  if (!files.length) return [];
  const kind = ['wide', 'dialog', 'pair', 'phones', 'crop'].find((k) => div.hasClass(k)) ?? 'wide';
  const clipped = div.find('.clip').length > 0;
  const hStyle = (div.find('.clip').first().attr('style') ?? div.find('img').first().attr('style') ?? '').match(/max-height:(\d+)mm/);
  const wantH = hStyle ? Number(hStyle[1]) : kind === 'dialog' ? 112 : kind === 'wide' ? 120 : 100;
  const maxH = Math.round((kind === 'dialog' ? Math.max(wantH, 125) : wantH * 0.85) * PX);
  const n = files.length;
  const gap = 12;
  // A phone picture is always a third of the width, even when the page shows one.
  const slots = kind === 'phones' ? 3 : n;
  const maxW = kind === 'wide' || kind === 'crop' ? CONTENT_PX : Math.floor((CONTENT_PX - gap * (slots - 1)) / slots);
  const children = [];
  for (const [i, src] of files.entries()) {
    const file = path.join(here, src);
    if (!fs.existsSync(file)) { console.warn(`  ⚠ ไม่มีภาพ ${src}`); continue; }
    let data = fs.readFileSync(file);
    let size = pngSize(file);
    if (clipped) {
      // Width-first: scale to the slot width, then keep only the top maxH.
      const scale = maxW / size.width;
      const keep = Math.min(size.height, Math.round(maxH / scale));
      if (keep < size.height) {
        data = await sharp(data).extract({ left: 0, top: 0, width: size.width, height: keep }).png().toBuffer();
        size = { width: size.width, height: keep };
      }
    }
    if (i) children.push(new TextRun({ text: '  ' }));
    children.push(new ImageRun({ type: 'png', data, transformation: fit(size, maxW, clipped ? 1e9 : maxH) }));
  }
  return [new Paragraph({ alignment: AlignmentType.CENTER, children, spacing: { before: 60, after: 60 } })];
}

function tableBlock($, tbl) {
  const head = tbl.find('thead th').map((i, th) => $(th).text().trim()).get();
  const bodyRows = tbl.find('tbody tr').get().map((tr) => $(tr).children('td').get());
  const cols = head.length || (bodyRows[0]?.length ?? 1);
  // First column is the label column; give it a bit less than an even share.
  const first = cols > 2 ? Math.round(CONTENT_W * 0.26) : Math.round(CONTENT_W * 0.36);
  const rest = Math.floor((CONTENT_W - first) / Math.max(cols - 1, 1));
  const widths = Array.from({ length: cols }, (_, i) => (i === 0 ? first : rest));
  widths[cols - 1] += CONTENT_W - widths.reduce((a, b) => a + b, 0);
  const cell = (children, w, opts = {}) => new TableCell({
    width: { size: w, type: WidthType.DXA },
    margins: { top: 70, bottom: 70, left: 100, right: 100 },
    borders: { top: noBorder, left: noBorder, right: noBorder, bottom: opts.head ? { style: BorderStyle.SINGLE, size: 10, color: GREEN_900 } : thinBottom },
    verticalAlign: VerticalAlign.TOP,
    children,
  });
  const rows = [];
  if (head.length) rows.push(new TableRow({ tableHeader: true, children: head.map((h, i) => cell([new Paragraph({ children: [new TextRun({ text: h, bold: true, color: GREEN_900 })] })], widths[i], { head: true })) }));
  for (const tds of bodyRows) rows.push(new TableRow({ children: tds.map((td, i) => cell([new Paragraph({ children: runs($, $(td), i === 0 ? { bold: true } : {}) })], widths[i])) }));
  return [new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED, rows }), spacer(80)];
}

function cardsBlock($, div) {
  const cards = div.children('.card').get();
  const w = Math.floor((CONTENT_W - 160) / cards.length);
  const widths = cards.map(() => w);
  const cells = cards.map((c, i) => {
    const card = $(c);
    const plain = card.hasClass('plain');
    const children = [
      new Paragraph({ children: [new TextRun({ text: card.children('h3').text().trim(), bold: true, color: GREEN_900, size: 23 })], spacing: { after: 60 } }),
      ...card.find('li').map((j, li) => new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing: { after: 40 }, children: runs($, $(li)) })).get(),
    ];
    return new TableCell({
      width: { size: w, type: WidthType.DXA },
      margins: { top: 140, bottom: 140, left: 160, right: 160 },
      shading: plain ? undefined : { type: ShadingType.CLEAR, fill: TINT, color: 'auto' },
      borders: plain ? { top: thinBottom, bottom: thinBottom, left: thinBottom, right: thinBottom } : noBorders,
      children,
    });
  });
  // Spacer cells between cards keep the gap without a visible border.
  const rowChildren = [];
  cells.forEach((c, i) => { if (i) rowChildren.push(new TableCell({ width: { size: 160, type: WidthType.DXA }, borders: noBorders, children: [new Paragraph('')] })); rowChildren.push(c); });
  const colWidths = [];
  widths.forEach((x, i) => { if (i) colWidths.push(160); colWidths.push(x); });
  return [new Table({ width: { size: colWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: colWidths, layout: TableLayoutType.FIXED, borders: noBorders, rows: [new TableRow({ cantSplit: true, children: rowChildren })] }), spacer(80)];
}

/** Convert one page's HTML body into docx blocks. */
async function blocks($, root) {
  const out = [];
  for (const node of root.contents()) {
    if (node.type === 'text') { if (node.data.trim()) out.push(text(node.data.trim())); continue; }
    if (node.type !== 'tag') continue;
    const el = $(node);
    const name = node.name;
    if (name === 'ol' && el.hasClass('steps')) out.push(...stepsBlock($, el));
    else if (name === 'div' && el.hasClass('note')) out.push(...noteBlock($, el, el.hasClass('warn')));
    else if (name === 'div' && el.hasClass('fig')) out.push(...await imageParas(el));
    else if (name === 'div' && el.hasClass('cards')) out.push(...cardsBlock($, el));
    else if (name === 'table') out.push(...tableBlock($, el));
    else if (name === 'h2') out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: el.text().trim(), bold: true, color: GREEN_900 })], spacing: { before: 200, after: 100 } }));
    else if (name === 'p' && el.hasClass('cap')) out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: el.text().trim(), color: MUTED, size: 17 })], spacing: { after: 120 } }));
    else if (name === 'div') out.push(...await blocks($, el)); // flex wrappers of the LINE manuals: flatten
    else out.push(new Paragraph({ children: runs($, el), spacing: { after: 100 } }));
  }
  while (out.length && SPACERS.has(out[out.length - 1])) out.pop();
  return out;
}

// ───────────────────────── page scaffolding ─────────────────────────

const eyebrow = (t, first = false) => new Paragraph({ pageBreakBefore: !first, children: [new TextRun({ text: t.toUpperCase(), bold: true, color: GREEN_700, size: 17 })], spacing: { after: 40 } });

function cover(m) {
  return [
    new Paragraph({ spacing: { before: 2400 }, children: [new TextRun({ text: 'Go Along Co., Ltd.', bold: true, color: GREEN_400, size: 24 })] }),
    new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: 'User Manual · Fameline Dock Queue', bold: true, color: GREEN_700, size: 20 })] }),
    new Paragraph({ children: [new TextRun({ text: 'คู่มือการใช้งาน', bold: true, size: 64, color: GREEN_900 })], spacing: { before: 200 } }),
    new Paragraph({ children: [new TextRun({ text: `สำหรับ${m.role}`, bold: true, size: 36 })], spacing: { after: 200 } }),
    new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: GREEN_400, space: 4 } }, children: [], spacing: { after: 300 } }),
    new Paragraph({ children: [new TextRun({ text: 'ระบบจองคิวรับ–ส่งสินค้าออนไลน์ผ่าน LINE', color: MUTED })] }),
    new Paragraph({ children: [new TextRun({ text: m.subtitle, color: MUTED })], spacing: { after: 600 } }),
    new Paragraph({ children: [new TextRun({ text: 'จัดทำโดย ', color: MUTED }), new TextRun({ text: 'Go Along Co., Ltd. (บริษัท โกอะลอง จำกัด)', bold: true })] }),
    new Paragraph({ children: [new TextRun({ text: 'เอกสาร ', color: MUTED }), new TextRun({ text: VERSION, bold: true })] }),
  ];
}

function toc(m) {
  const out = [eyebrow('Contents'), new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'สารบัญ', bold: true, size: 42 })] }),
    new Paragraph({ children: [new TextRun({ text: `คู่มือการใช้งานสำหรับ${m.role}`, color: MUTED, size: 22 })], spacing: { after: 240 } })];
  // Entries link to the section headings (bookmarks); a page column would drift
  // because Word reflows the pages, so there is none.
  m.pages.forEach((p, i) => out.push(new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 2 } },
    spacing: { before: 80, after: 80 },
    children: [
      new TextRun({ text: `${String(i + 1).padStart(2, '0')}   `, bold: true, color: GREEN_400 }),
      new InternalHyperlink({ anchor: `sec${i + 1}`, children: [new TextRun({ text: p.title, bold: true })] }),
    ],
  })));
  return out;
}

async function contentPage($, p, index) {
  const out = [eyebrow(p.eyebrow),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new Bookmark({ id: `sec${index + 1}`, children: [new TextRun({ text: p.title, bold: true, size: 40 })] })], spacing: { after: 60 } }),
    new Paragraph({ children: [new TextRun({ text: p.lead, color: MUTED, size: 22 })], spacing: { after: 200 } }),
    ...await blocks($, $('body'))];
  return out;
}

function contact(m) {
  const row = (k, v) => new Paragraph({ children: [new TextRun({ text: `${k}  `, bold: true, color: GREEN_900 }), new TextRun({ text: v })], spacing: { after: 80 } });
  return [
    eyebrow('Contact us'),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'ติดต่อเรา', bold: true, size: 40 })], spacing: { after: 200 } }),
    row('อีเมล', 'info@goalong.co.th'), row('โทรศัพท์', '085-608-3298'), row('เว็บไซต์', 'www.goalong.co.th'),
    row('ที่อยู่', '918/288 หมู่ 10 ต.ในคลองบางปลากด อ.พระสมุทรเจดีย์ จ.สมุทรปราการ 10290'), row('เวลาทำการ', 'จันทร์–ศุกร์ 08:30–17:30 น.'),
    new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: 'บริษัท โกอะลอง จำกัด', bold: true, color: GREEN_900, size: 26 })] }),
    new Paragraph({ children: [new TextRun({ text: 'Software & Mobile Development', color: MUTED })], spacing: { after: 200 } }),
    new Paragraph({ children: [new TextRun({ text: (m.contactNote ?? 'พบปัญหาการใช้งาน แจ้งได้จากปุ่มแจ้งปัญหามุมซ้ายล่างของทุกหน้าในระบบ หรือติดต่อตามช่องทางด้านบนในเวลาทำการ').replace(/<[^>]+>/g, '') })] }),
  ];
}

async function build(m) {
  const children = [...cover(m), ...toc(m)];
  for (const [i, p] of m.pages.entries()) {
    const $ = cheerio.load(`<body>${p.html}</body>`);
    children.push(...await contentPage($, p, i));
  }
  children.push(...contact(m));
  return new Document({
    creator: 'Go Along Co., Ltd.',
    title: `คู่มือการใช้งาน — ${m.role}`,
    styles: {
      default: { document: { run: { font: FONT, size: 21 }, paragraph: { spacing: { line: 300 } } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, bold: true, size: 40, color: '1A1A1A' }, paragraph: { spacing: { before: 0, after: 60 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, bold: true, size: 25, color: GREEN_900 }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 } },
      ],
    },
    numbering: {
      config: [
        { reference: 'steps', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { run: { bold: true, color: GREEN_900 }, paragraph: { indent: { left: 560, hanging: 400 } } } }] },
        { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] },
      ],
    },
    sections: [{
      properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, bottom: Math.round(18 * MM), left: MARGIN, right: MARGIN } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `คู่มือการใช้งาน · ${m.role}`, color: MUTED, size: 16 })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: LINE, space: 4 } },
        children: [new TextRun({ text: 'Go Along Co., Ltd.', bold: true, color: GREEN_900, size: 17 }), new TextRun({ text: '\t', size: 17 }), new TextRun({ children: [PageNumber.CURRENT], bold: true, color: GREEN_900, size: 17 })],
      })] }) },
      children,
    }],
  });
}

fs.mkdirSync(OUT, { recursive: true });
for (const m of MANUALS) {
  if (only && !m.file.includes(only)) continue;
  const buf = await Packer.toBuffer(await build(m));
  const file = path.join(OUT, `${m.file}.docx`);
  fs.writeFileSync(file, buf);
  console.log(`✓ ${m.file}.docx (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
}
