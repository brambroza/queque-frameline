// Builds the Fameline Dock Queue training deck as a .pptx (Thai, 16:9 wide).
const path = require('path');
const pptxgen = require('pptxgenjs');
const { applyTheme } = require('/Users/amnartkongpet/.claude/skills/synced/a9dc737a-61bf-463f-9a3c-3f51eccc182d_637cd738-7a7f-4b33-8f09-29f557228097/pptx/scripts/apply_theme.js');

const SHOTS = '/Users/amnartkongpet/Project/GoAlong/2026/Queue-fameline/docs/manuals/screenshots';
const OUT = process.argv[2];

const THEME = {
  name: 'Fameline',
  headFontFace: 'Tahoma',
  bodyFontFace: 'Tahoma',
  colors: {
    dk1: '14271E', lt1: 'FBFCFA', dk2: '002C1F', lt2: 'F3F6F1',
    accent1: '0B7A47', accent2: 'ADC32B', accent3: 'AEDBC0', accent4: '2563C9',
    accent5: 'D08A12', accent6: '7E3AA8', hlink: '0B7A47', folHlink: '44564C',
  },
};
const COL = {
  ink: '14271E', head: '0F2A1F', body: '44564C', green: '0B7A47', brand: '002C1F',
  lime: 'ADC32B', mint: 'AEDBC0', bg: 'F3F6F1', bg2: 'E6EEE7', card: 'FBFCFA',
  line: 'D3DDD5', warnBg: 'FBEFD9', warnInk: '5A2A06', noteBg: 'E1EFE5', onDark: 'E7F3EC', onDark2: '9CC4AE',
};

/** Pixel size of each screenshot, used for contain-fit placement. */
const DIMS = {
  'common/00-invite-email': [1440, 2488], 'sales/01-home': [3200, 2000], 'sales/02-add': [1200, 1132],
  'sales/04-link': [888, 1164], 'sales/b1-vehicle': [780, 1688], 'sales/b6-done': [780, 1688],
  'whm/05-approve': [888, 1568], 'whm/13-board': [3200, 2000], 'whm/14-complete': [1800, 1120],
  'whm/15-walkin': [1200, 1780], 'whm/12-schedule-board': [1800, 1872], 'whm/18-tv': [3200, 1800],
  'whm/d3-driver-called': [780, 1688], 'whm/01-dashboard': [3200, 2000], 'admin/02-staff': [3200, 2000],
  'line/l4-confirmed': [780, 1520], 'line/l5-my-queues': [780, 1520], 'line/g2-feed': [780, 1640],
};

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 in
pres.title = 'อบรมระบบคิวหน้าคลัง Fameline';
pres.author = 'GoAlong';
pres.company = 'GoAlong';
pres.theme = { headFontFace: 'Tahoma', bodyFontFace: 'Tahoma' };

const W = 13.333;
const MX = 0.75;
const CW = W - MX * 2;

/** Adds the eyebrow + title block at the fixed top position. */
function head(slide, eyebrow, title, x = MX, w = CW) {
  slide.addText(eyebrow, { x, y: 0.45, w, h: 0.4, fontSize: 13, bold: true, color: COL.green, charSpacing: 1, margin: 0, isTextBox: true });
  slide.addText(title, { x, y: 0.85, w, h: 0.8, fontSize: 32, bold: true, color: COL.head, margin: 0, valign: 'top', isTextBox: true });
}

/** Places a screenshot contain-fit inside a framed box. */
function shot(slide, key, x, y, w, h, { frame = COL.card, alt = '' } = {}) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: 0.12, fill: { color: frame }, line: { color: COL.line, width: 0.75 },
    shadow: { type: 'outer', color: '0F2A1F', opacity: 0.12, blur: 10, offset: 3, angle: 90 },
  });
  const [pw, ph] = DIMS[key];
  const pad = 0.08;
  const bw = w - pad * 2;
  const bh = h - pad * 2;
  const s = Math.min(bw / pw, bh / ph);
  const iw = pw * s;
  const ih = ph * s;
  slide.addImage({ path: path.join(SHOTS, `${key}.png`), x: x + pad + (bw - iw) / 2, y: y + pad + (bh - ih) / 2, w: iw, h: ih, altText: alt });
}

/** Numbered step list. */
function steps(slide, items, x, y, w, h, fontSize = 16) {
  // Numbers are written as text: auto-numbering restarts at 1 per paragraph in some viewers.
  slide.addText(items.map((t, i) => ({ text: `${i + 1}.  ${t}`, options: { breakLine: i < items.length - 1 } })), {
    x, y, w, h, fontSize, color: COL.ink, paraSpaceAfter: 8, valign: 'top', margin: 0, isTextBox: true,
  });
}

/** Tinted callout box (warning or note) without edge stripes. */
function callout(slide, runs, x, y, w, h, kind = 'note') {
  const warn = kind === 'warn';
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.1, fill: { color: warn ? COL.warnBg : COL.noteBg }, line: { type: 'none' } });
  slide.addText(runs, { x: x + 0.2, y: y + 0.1, w: w - 0.4, h: h - 0.2, fontSize: 14, color: warn ? COL.warnInk : COL.head, valign: 'middle', margin: 0, isTextBox: true });
}

/** Card with a title and short body text. */
function card(slide, title, body, x, y, w, h, { dot } = {}) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: COL.card }, line: { color: COL.line, width: 0.75 } });
  let tx = x + 0.25;
  if (dot) {
    slide.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.32, w: 0.22, h: 0.22, fill: { color: dot }, line: { type: 'none' } });
    tx = x + 0.6;
  }
  slide.addText(title, { x: tx, y: y + 0.2, w: x + w - 0.25 - tx, h: 0.5, fontSize: 16, bold: true, color: COL.head, margin: 0, valign: 'middle', isTextBox: true });
  slide.addText(body, { x: x + 0.25, y: y + 0.75, w: w - 0.5, h: h - 0.95, fontSize: 13, color: COL.body, margin: 0, valign: 'top', isTextBox: true });
}

/** Simple table with a tinted header and banded rows. */
function table(slide, header, rows, x, y, w, colW, fontSize = 14) {
  const data = [
    header.map((t) => ({ text: t, options: { bold: true, color: COL.head, fill: { color: COL.bg2 } } })),
    ...rows.map((r, i) => r.map((t) => ({ text: t, options: { color: COL.ink, fill: { color: i % 2 ? COL.bg : COL.card } } }))),
  ];
  slide.addTable(data, { x, y, w, colW, fontSize, fontFace: 'Tahoma', border: { type: 'solid', color: COL.line, pt: 0.75 }, margin: [5, 8, 5, 8], valign: 'middle' });
}

/** Light content slide with background and section. */
function light(section, bg = COL.bg) {
  const s = pres.addSlide({ sectionTitle: section });
  s.background = { color: bg };
  return s;
}

/** Dark section divider. */
function divider(section, kicker, title, sub, notes) {
  pres.addSection({ title: section });
  const s = pres.addSlide({ sectionTitle: section });
  s.background = { color: COL.brand };
  s.addText(kicker, { x: MX, y: 2.2, w: CW, h: 0.6, fontSize: 22, bold: true, color: COL.lime, margin: 0, isTextBox: true });
  s.addText(title, { x: MX, y: 2.85, w: CW, h: 1.3, fontSize: 48, bold: true, color: 'F4FAF6', margin: 0, valign: 'top', isTextBox: true });
  s.addText(sub, { x: MX, y: 4.35, w: 10.5, h: 0.9, fontSize: 20, color: COL.mint, margin: 0, valign: 'top', isTextBox: true });
  s.addNotes(notes);
  return s;
}

// ─────────────── Section 1: overview ───────────────
const S1 = 'ภาพรวม';
pres.addSection({ title: S1 });

{
  const s = pres.addSlide({ sectionTitle: S1 });
  s.background = { color: COL.brand };
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX, y: 1.2, w: 2.0, h: 0.5, rectRadius: 0.25, fill: { color: COL.lime }, line: { type: 'none' } });
  s.addText('อบรมผู้ใช้งาน', { x: MX, y: 1.2, w: 2.0, h: 0.5, fontSize: 14, bold: true, color: COL.ink, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
  s.addText('Fameline\nDock Queue', { x: MX, y: 1.95, w: 6.0, h: 2.3, fontSize: 52, bold: true, color: 'F4FAF6', margin: 0, valign: 'top', isTextBox: true });
  s.addText('ระบบจองคิว รับ–ส่งสินค้า หน้าคลัง', { x: MX, y: 4.3, w: 6.0, h: 0.6, fontSize: 20, color: COL.mint, margin: 0, isTextBox: true });
  s.addText('[วันที่อบรม] · [สถานที่]', { x: MX, y: 6.0, w: 6.0, h: 0.4, fontSize: 14, color: COL.onDark, margin: 0, isTextBox: true });
  s.addText('บริษัท เฟมไลน์ โปรดักส์ จำกัด · จัดทำโดย บริษัท โกอะลอง จำกัด', { x: MX, y: 6.4, w: 7.0, h: 0.4, fontSize: 12, color: COL.onDark2, margin: 0, isTextBox: true });
  s.addImage({ path: path.join(SHOTS, 'whm/18-tv.png'), x: 7.0, y: 1.7, w: 5.6, h: 3.15, rounding: false, altText: 'จอเรียกคิวบน TV หน้าลาน' });
  s.addNotes('ทักทาย แนะนำทีมวิทยากร เป้าหมาย: จบการอบรม ทุกคนทำงานในบทบาทของตัวเองบนระบบได้จริง ภาพบนสไลด์เป็นหน้าจอจริงจากข้อมูลตัวอย่าง ไม่ใช่ข้อมูลลูกค้าจริง ขอให้ทุกคนมีบัญชีและล็อกอินได้ก่อนช่วงฝึกปฏิบัติ');
}

{
  const s = light(S1);
  head(s, 'กำหนดการ', '5 ช่วง เลือกเข้าตามบทบาท');
  table(s, ['ช่วง', 'หัวข้อ', 'ผู้เข้าอบรม', 'เวลา'], [
    ['1', 'ภาพรวมระบบ บทบาท สถานะคิว', 'ทุกคน', '30 นาที'],
    ['2', 'คีย์ SO / PO ชำระเงิน ส่งลิงก์จอง', 'ฝ่ายขาย · ฝ่ายจัดซื้อ', '30 นาที'],
    ['3', 'งานหน้างาน: อนุมัติ ถึง ปิดงาน', 'ทีมคลัง · ป้อมยาม', '60 นาที'],
    ['4', 'แดชบอร์ด สิทธิ์ ตั้งค่าระบบ', 'ผู้จัดการ · ผู้บริหาร · Admin', '30 นาที'],
    ['5', 'LINE OA และฝึกปฏิบัติจริง', 'ทุกคน', '45 นาที'],
  ], MX, 1.9, CW, [0.9, 5.4, 4.2, 1.33], 16);
  s.addText('เวลาเป็นค่าแนะนำ ปรับตามจำนวนผู้เข้าอบรม · คู่มือ PDF แยกตามบทบาทแจกหลังอบรม', { x: MX, y: 6.4, w: CW, h: 0.4, fontSize: 13, color: COL.body, margin: 0, isTextBox: true });
  s.addNotes('ช่วง 1 และ 5 ทุกคนเข้า ช่วง 2-4 เลือกตามหน้าที่ อบรมรวมห้องเดียวประมาณ 3 ชั่วโมงรวมพัก มีคู่มือ PDF 7 เล่ม แยกตามบทบาท');
}

{
  const s = light(S1);
  head(s, 'ภาพรวม', 'เส้นทางของ 1 คิว ตั้งแต่เอกสารถึงปิดงาน');
  const items = [
    ['1', 'คีย์ SO / PO', 'ฝ่ายขาย · ฝ่ายจัดซื้อ'], ['2', 'ส่งลิงก์ / QR', 'ลิงก์เฉพาะเอกสารใบนั้น'],
    ['3', 'คู่ค้าจองคิวเอง', 'เลือกรถ วัน เวลา'], ['4', 'อนุมัติ + ออก DO', 'ทีมคลัง'],
    ['5', 'รถมาถึง · เช็คอิน', 'ป้อมยาม หรือคนขับกดเอง'], ['6', 'เรียกเข้าท่า', 'อัตโนมัติเมื่อท่าว่าง'],
    ['7', 'ขึ้น/ลงของ · ปิดงาน', 'ลงชื่อ 2 ฝ่ายบนใบ DO'],
  ];
  const cw = (CW - 0.3 * 3) / 4;
  items.forEach(([n, t, b], i) => {
    const x = MX + (i % 4) * (cw + 0.3);
    const y = 1.95 + Math.floor(i / 4) * 2.4;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: cw, h: 2.1, rectRadius: 0.12, fill: { color: COL.card }, line: { color: COL.line, width: 0.75 } });
    s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.25, w: 0.6, h: 0.6, fill: { color: COL.green }, line: { type: 'none' } });
    s.addText(n, { x: x + 0.25, y: y + 0.25, w: 0.6, h: 0.6, fontSize: 18, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    s.addText(t, { x: x + 0.25, y: y + 1.0, w: cw - 0.5, h: 0.5, fontSize: 16, bold: true, color: COL.head, margin: 0, isTextBox: true });
    s.addText(b, { x: x + 0.25, y: y + 1.5, w: cw - 0.5, h: 0.45, fontSize: 13, color: COL.body, margin: 0, isTextBox: true });
  });
  const x = MX + 3 * (cw + 0.3);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.35, w: cw, h: 2.1, rectRadius: 0.12, fill: { color: COL.brand }, line: { type: 'none' } });
  s.addText([{ text: 'จำไว้', options: { bold: true, color: COL.lime, breakLine: true } }, { text: 'SO ต้อง ชำระแล้ว หรือ เครดิต ก่อนอนุมัติ', options: { color: COL.onDark } }],
    { x: x + 0.25, y: 4.55, w: cw - 0.5, h: 1.7, fontSize: 15, valign: 'middle', margin: 0, paraSpaceAfter: 6, isTextBox: true });
  s.addNotes('เล่าเส้นทางเดียวให้ทุกคนเห็นภาพรวมก่อน ขั้น 1-2 ฝ่ายขาย/จัดซื้อ ขั้น 3 ลูกค้าหรือผู้ขายทำเองผ่านลิงก์ ไม่ต้องล็อกอิน ขั้น 4-7 ทีมคลัง รถที่มาโดยไม่ได้จองใช้ Walk-in ซึ่งรวมขั้น 3-5 ไว้ในหน้าต่างเดียว PO ไม่มีการตรวจการชำระเงิน');
}

{
  const s = light(S1);
  head(s, 'ภาพรวม', 'ใครทำอะไรในระบบ');
  table(s, ['บทบาท', 'หน้าที่ในระบบ', 'เมนูหลัก'], [
    ['ผู้ดูแลระบบ', 'พนักงาน สิทธิ์ สาขา LINE ERP', 'ทุกเมนู'],
    ['แอดมินฝ่ายขาย', 'คีย์ SO · บันทึกชำระเงิน · ส่งลิงก์ · Walk-in', 'ใบสั่งขาย (SO)'],
    ['ฝ่ายจัดซื้อ', 'คีย์ PO · ส่งลิงก์ · Walk-in', 'ใบสั่งซื้อ (PO)'],
    ['แอดมินคลัง', 'อนุมัติ · เช็คอิน · เรียกเข้าท่า · ปิดงาน', 'คิว · บอร์ดคิว · จอคิว'],
    ['ผู้จัดการคลัง', 'งานคลังทั้งหมด + รายงาน + ตั้งค่าคลัง', '+ แดชบอร์ด · รายงาน'],
    ['ผู้บริหาร', 'ดูอย่างเดียว · ส่งออกข้อมูล', 'แดชบอร์ด · ปฏิทิน · รายงาน'],
    ['คู่ค้า · คนขับ', 'ไม่ต้องล็อกอิน ใช้ลิงก์ + LINE OA', 'หน้าลิงก์บนมือถือ'],
  ], MX, 1.9, CW, [2.6, 5.4, 3.83], 15);
  s.addNotes('สิทธิ์มี 4 ระดับ: admin, manager (ผู้จัดการคลัง), staff (แอดมินขาย จัดซื้อ แอดมินคลัง) และ viewer (ผู้บริหาร ดูอย่างเดียว) ถ้าใครหาเมนูไม่เจอ ให้ตรวจสิทธิ์กับผู้ดูแลระบบ แต่ละ role จำกัดสาขาได้');
}

{
  const s = light(S1);
  head(s, 'ภาพรวม', 'สถานะคิว 8 แบบ ที่ทุกคนต้องอ่านออก');
  const st = [
    ['รอยืนยัน', 'รอคลังอนุมัติ SO ที่ยังไม่ชำระ ค้างที่นี่', 'D08A12'],
    ['ยืนยันแล้ว', 'ออกเลข DO และลิงก์คนขับแล้ว', '0B7A47'],
    ['เลยเวลานัด', 'เกินเวลาเผื่อ รถยังเช็คอินได้', 'C2410C'],
    ['มาถึงแล้ว · รอเรียก', 'เช็คอินแล้ว รอในลาน', '7E3AA8'],
    ['กำลังเรียกเข้าท่า', 'ขึ้นจอ TV และแจ้งคนขับแล้ว', '2563C9'],
    ['กำลังขึ้น/ลงของ', 'รถอยู่ที่ท่า', '12996A'],
    ['เสร็จสิ้น', 'ปิดงานแล้ว ท่าว่าง', '5B6B63'],
    ['ไม่มา / ยกเลิก', 'ช่วงเวลานั้นกลับมาว่าง', 'B91C1C'],
  ];
  const cw = (CW - 0.3 * 3) / 4;
  st.forEach(([t, b, c], i) => card(s, t, b, MX + (i % 4) * (cw + 0.3), 1.95 + Math.floor(i / 4) * 2.35, cw, 2.05, { dot: c }));
  s.addNotes('อ่านเรียงจากซ้ายบนไปขวาล่าง คือลำดับปกติของคิว เลยเวลานัดไม่ได้แปลว่าคิวหาย รถมาถึงแล้วยังกดรถมาถึงแล้วได้ ถ้าเลยเวลาเผื่อสองเท่า ระบบปรับเป็นไม่มาอัตโนมัติ (ตั้งเปิดปิดได้) การยกเลิกจากพอร์ทัลต้องใส่เหตุผลเสมอ ลูกค้าเห็นเหตุผลนั้น');
}

{
  const s = light(S1);
  shot(s, 'common/00-invite-email', MX, 0.5, 3.6, 6.5, { frame: COL.bg2, alt: 'อีเมลคำเชิญเข้าใช้งาน' });
  const x = 5.0;
  const w = W - MX - x;
  head(s, 'เริ่มต้นใช้งาน', 'เข้าใช้งานครั้งแรก', x, w);
  steps(s, [
    'เปิดอีเมล คำเชิญเข้าใช้งาน (ไม่เจอ ดู Junk / Spam)',
    'กด ยอมรับคำเชิญและตั้งรหัสผ่าน',
    'ตั้งรหัสผ่าน อย่างน้อย 8 ตัว แล้วกด บันทึก',
    'ครั้งถัดไป ล็อกอินด้วยอีเมล + รหัสผ่าน',
  ], x, 1.9, w, 2.3, 17);
  callout(s, [{ text: 'ข้อควรระวัง · ', options: { bold: true } }, { text: 'ลิงก์ในอีเมลใช้ได้ครั้งเดียวและมีอายุ หมดอายุแล้วขอผู้ดูแลระบบส่งใหม่ ห้ามส่งต่ออีเมลเชิญ' }], x, 4.4, w, 1.1, 'warn');
  s.addText('ลืมรหัสผ่าน: กด ลืมรหัสผ่าน? ที่หน้าเข้าสู่ระบบ', { x, y: 5.8, w, h: 0.4, fontSize: 14, color: COL.body, margin: 0, isTextBox: true });
  s.addNotes('บางองค์กรใช้รหัสผ่านเริ่มต้นร่วมแทนอีเมลเชิญ ถ้าใช้แบบนั้น ระบบจะชวนเปลี่ยนรหัสทุกครั้งที่ล็อกอินจนกว่าจะเปลี่ยน ขอให้ทุกคนเปลี่ยนวันนี้ แนะนำ Chrome หรือ Edge ใช้บัญชีของตัวเองเท่านั้น เพราะทุกการแก้ไขถูกบันทึกชื่อผู้ทำ');
}

// ─────────────── Section 2: sales / purchasing ───────────────
divider('ฝ่ายขาย · จัดซื้อ', 'ช่วงที่ 2', 'ฝ่ายขาย และ ฝ่ายจัดซื้อ', 'คีย์เอกสาร · บันทึกการชำระเงิน · ส่งลิงก์จองคิว · ติดตามสถานะ',
  'ช่วงนี้ใช้ตัวอย่าง SO เป็นหลัก PO ทำเหมือนกันทุกขั้น ต่างกันที่ไม่มีการชำระเงิน และกรอกรายการสินค้าได้ (ไม่บังคับ) ซึ่งช่วยให้คลังประเมินเวลาที่ท่า');
const S2 = 'ฝ่ายขาย · จัดซื้อ';

/** Screenshot left (wide) + stacked label/text pairs right. */
function wideShotWithFacts(s, key, alt, facts) {
  shot(s, key, MX, 1.9, 7.6, 4.75, { alt });
  const x = MX + 7.6 + 0.4;
  const w = W - MX - x;
  facts.forEach(([t, b], i) => {
    s.addText(t, { x, y: 1.95 + i * 1.18, w, h: 0.42, fontSize: 16, bold: true, color: COL.head, margin: 0, isTextBox: true });
    s.addText(b, { x, y: 2.37 + i * 1.18, w, h: 0.7, fontSize: 13, color: COL.body, margin: 0, valign: 'top', isTextBox: true });
  });
}

{
  const s = light(S2);
  head(s, 'ใบสั่งขาย (SO) · ใบสั่งซื้อ (PO)', 'หน้ารายการเอกสาร');
  wideShotWithFacts(s, 'sales/01-home', 'หน้ารายการใบสั่งขาย', [
    ['ชำระเงิน', 'ยังไม่ชำระ · ชำระแล้ว · เครดิต (เฉพาะ SO)'],
    ['สถานะเอกสาร', 'รอจองคิว · มีคิวแล้ว · ปิดแล้ว · ยกเลิก'],
    ['ปุ่มท้ายแถว', 'บันทึกชำระเงิน · รูปรถ (Walk-in) · ลิงก์ · แก้ไข · ปิด · ยกเลิก'],
    ['กดเลขที่สีเขียว', 'ดูคิวทุกเที่ยวของเอกสารใบนั้น'],
  ]);
  s.addNotes('หน้าทำงานหลักของฝ่ายขาย ค้นหาจากเลขที่หรือชื่อลูกค้า กรองตามการชำระเงินและสถานะ ปุ่มลบใช้ได้เฉพาะเอกสารที่ยังไม่มีคิว เอกสารที่มาจาก ERP ถ้าแก้ที่หน้านี้ ค่าจะถูกทับเมื่อ ERP ส่งเลขเดิมมาอีก');
}

{
  const s = light(S2);
  head(s, 'ใบสั่งขาย (SO) · ใบสั่งซื้อ (PO)', 'เพิ่มเอกสาร ทีละใบ');
  shot(s, 'sales/02-add', MX, 1.9, 5.0, 4.75, { alt: 'ฟอร์มเพิ่มใบสั่งขาย' });
  const x = MX + 5.0 + 0.5;
  const w = W - MX - x;
  steps(s, ['กด เพิ่ม SO มุมขวาบน', 'เลือก สาขา / คลัง ที่รับ–ส่งสินค้า', 'กรอก เลขที่ · วันที่ · กำหนดส่ง', 'เลือก สถานะการชำระเงิน (SO)', 'พิมพ์ชื่อคู่ค้า แล้วเลือกจากรายการ', 'กด บันทึกเอกสาร'], x, 1.95, w, 3.2, 17);
  callout(s, [
    { text: 'เลขที่ซ้ำ', options: { bold: true } }, { text: ' = อัปเดตใบเดิม ไม่สร้างใบใหม่', options: { breakLine: true } },
    { text: 'คู่ค้ารายใหม่', options: { bold: true } }, { text: ' = กรอกชื่อ + เบอร์ ระบบบันทึกให้เอง' },
  ], x, 5.35, w, 1.3);
  s.addNotes('สาขาสำคัญที่สุด เพราะลูกค้าเห็นเฉพาะท่าและเวลาทำการของสาขาที่เลือก และเปลี่ยนสาขาไม่ได้ขณะยังมีคิวที่ไม่ปิด PO มีปุ่มเพิ่มรายการสินค้า (ไม่บังคับ) ยิ่งใส่รายการ คลังยิ่งประเมินเวลาที่ท่าได้แม่น ถ้าเชื่อม ERP แล้ว เอกสารจะเข้ามาเอง');
}

{
  const s = light(S2, COL.lime);
  s.addText('กติกาสำคัญของ SO', { x: MX, y: 1.0, w: CW, h: 0.5, fontSize: 16, bold: true, color: COL.ink, margin: 0, isTextBox: true });
  s.addText('ยังไม่ชำระ = ลูกค้าจองได้\nแต่คลังอนุมัติไม่ได้', { x: MX, y: 1.6, w: CW, h: 2.2, fontSize: 44, bold: true, color: COL.head, margin: 0, valign: 'top', isTextBox: true });
  const cw = (CW - 0.4 * 2) / 3;
  [['ฝ่ายขายทำ', 'กด บันทึกชำระเงิน เลือก ชำระแล้ว หรือ เครดิต'], ['ระบบทำต่อ', 'แจ้งทีมคลังทันที ว่าคิวไหนอนุมัติได้แล้ว'], ['ห้ามลืม', 'มีคิวอนุมัติแล้ว จะเปลี่ยนกลับเป็น ยังไม่ชำระ ไม่ได้']].forEach(([t, b], i) => {
    const x = MX + i * (cw + 0.4);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.3, w: cw, h: 2.0, rectRadius: 0.12, fill: { color: 'F4F8E4' }, line: { type: 'none' } });
    s.addText(t, { x: x + 0.3, y: 4.5, w: cw - 0.6, h: 0.5, fontSize: 17, bold: true, color: COL.head, margin: 0, isTextBox: true });
    s.addText(b, { x: x + 0.3, y: 5.05, w: cw - 0.6, h: 1.1, fontSize: 14, color: '2E3B33', margin: 0, valign: 'top', isTextBox: true });
  });
  s.addNotes('จุดที่พลาดบ่อยที่สุด: ลูกค้าจองแล้ว คลังกดอนุมัติไม่ได้ เพราะฝ่ายขายยังไม่บันทึกการชำระ ถ้าเปิดยกเลิกคิวที่ยังไม่ชำระอัตโนมัติไว้ คิวที่ลูกค้าจองเองจะถูกยกเลิกเมื่อครบเวลา โดยลูกค้าได้คำเตือนก่อน 1 ครั้ง PO ไม่มีกติกานี้');
}

{
  const s = light(S2);
  shot(s, 'sales/04-link', MX, 0.5, 4.8, 6.5, { frame: COL.bg2, alt: 'หน้าต่างลิงก์จองคิวและ QR' });
  const x = 6.1;
  const w = W - MX - x;
  head(s, 'ใบสั่งขาย (SO) · ใบสั่งซื้อ (PO)', 'ส่งลิงก์จองคิว / QR', x, w);
  steps(s, ['ที่แถวเอกสาร กด ลิงก์', 'กด คัดลอกลิงก์ ส่งทาง LINE หรืออีเมล', 'หรือให้คู่ค้าสแกน QR', 'คู่ค้าผูก LINE แล้ว ส่งทาง LINE ได้ตรง'], x, 1.9, w, 2.3, 17);
  s.addText('1 ลิงก์ = 1 เอกสาร · มีวันหมดอายุ ใต้ช่องลิงก์', { x, y: 4.25, w, h: 0.4, fontSize: 14, color: COL.body, margin: 0, isTextBox: true });
  callout(s, [{ text: 'ข้อควรระวัง · ', options: { bold: true } }, { text: 'กด สร้างลิงก์ใหม่ แล้วลิงก์เดิมใช้ไม่ได้ทันที ใช้เมื่อหมดอายุหรือส่งผิดคนเท่านั้น' }], x, 4.9, w, 1.1, 'warn');
  s.addNotes('ลิงก์และ QR แสดงซ้ำได้เสมอ ไม่ต้องสร้างใหม่ทุกครั้ง แนะนำให้ลูกค้าเปิดลิงก์ผ่าน LINE ครั้งแรก ระบบจะผูกบัญชี LINE กับเอกสาร แล้วลูกค้าได้แจ้งเตือนทุกครั้งที่คิวเปลี่ยน เอกสารที่ปิดหรือยกเลิกแล้วจองไม่ได้');
}

{
  const s = light(S2, COL.bg2);
  shot(s, 'sales/b1-vehicle', MX, 0.5, 3.05, 6.5, { alt: 'มือถือลูกค้า เลือกประเภทรถ' });
  shot(s, 'sales/b6-done', MX + 3.3, 0.5, 3.05, 6.5, { alt: 'มือถือลูกค้า จองสำเร็จ รอเจ้าหน้าที่ยืนยัน' });
  const x = 7.6;
  const w = W - MX - x;
  head(s, 'สิ่งที่คู่ค้าเห็น', 'จองคิวเอง บนมือถือ', x, w);
  steps(s, ['เลือกประเภทรถ', 'เลือกวัน และเวลาที่ว่าง', 'กรอกทะเบียน ชื่อ และเบอร์คนขับ', 'ได้เลขคิว รอคลังยืนยัน'], x, 1.9, w, 2.4, 17);
  s.addText('หลังจอง เปลี่ยนทะเบียน / คนขับ หรือยกเลิกเองได้ ก่อนรถเช็คอิน', { x, y: 4.5, w, h: 0.9, fontSize: 14, color: COL.body, margin: 0, valign: 'top', isTextBox: true });
  s.addNotes('ใช้ตอบลูกค้าที่โทรมาถามว่าจองยังไง ไม่ต้องล็อกอิน ไม่ต้องลงแอป ช่องบังคับมี 3 ช่อง ทะเบียน ชื่อคนขับ เบอร์คนขับ ถ้าต้องการเลื่อนวันหรือเวลาหลังจอง ให้ติดต่อคลัง รับหลายเที่ยวได้ด้วยปุ่มจองคิวเพิ่ม');
}

// ─────────────── Section 3: warehouse ───────────────
divider('ทีมคลัง', 'ช่วงที่ 3', 'ทีมคลัง หน้างาน', 'อนุมัติ · เช็คอิน · เรียกเข้าท่า · ปิดงาน · Walk-in · จัดตารางคิว',
  'ช่วงที่ยาวที่สุด ให้ผู้เข้าอบรมเปิดบอร์ดคิวบนเครื่องตัวเองตามไปด้วย ถ้ามีจอ TV หน้าลาน เปิดจอคิวคู่กันจะเห็นผลทันทีเมื่อกดเรียก');
const S3 = 'ทีมคลัง';

{
  const s = light(S3);
  shot(s, 'whm/05-approve', MX, 0.5, 3.75, 6.5, { frame: COL.bg2, alt: 'หน้าต่างอนุมัติคิวและออก DO' });
  const x = 5.0;
  const w = W - MX - x;
  head(s, 'คิวรับ-ส่งสินค้า', 'อนุมัติคิว + ออกใบ DO', x, w);
  steps(s, ['คิวสถานะ รอยืนยัน กด อนุมัติคิว + ออก DO', 'ตรวจ เวลาที่ท่า (นาที) ที่ระบบแนะนำ', 'ดูแถบเวลาของท่า ปรับนาทีไม่ให้ชนคิวถัดไป', 'กด อนุมัติ + ออก DO'], x, 1.9, w, 2.5, 17);
  const cw = (w - 0.3) / 2;
  card(s, 'เวลาแนะนำ', 'จำนวนรายการ × นาทีต่อรายการ หรือเวลาของประเภทรถ', x, 4.6, cw, 1.9);
  card(s, 'เลข DO', 'ออกอัตโนมัติ ไม่ซ้ำ เรียงต่อเนื่องในเดือน', x + cw + 0.3, 4.6, cw, 1.9);
  s.addNotes('ปุ่มเวลาที่ชนคิวอื่นเป็นสีเทา กดไม่ได้ เส้นแดงคือเวลาที่ต้องจบก่อนคิวถัดไป (รวมเวลาเผื่อ turnaround) หลังอนุมัติ ระบบส่งเลข DO และลิงก์คนขับให้คู่ค้าทาง LINE อัตโนมัติถ้าผูกไว้ SO ที่ยังไม่ชำระกดอนุมัติไม่ได้');
}

{
  const s = light(S3);
  head(s, 'บอร์ดคิว', 'ควบคุมหน้างาน ด้วยปุ่มเดียวต่อขั้น');
  shot(s, 'whm/13-board', MX, 1.9, 7.6, 4.75, { alt: 'บอร์ดคิว 6 คอลัมน์' });
  const x = MX + 7.6 + 0.4;
  table(s, ['คอลัมน์', 'ปุ่มหลัก'], [
    ['รอยืนยัน', 'อนุมัติ + DO'], ['รอรถมาถึง', 'รถมาถึงแล้ว'], ['มาถึงแล้ว · รอเรียก', 'เรียกเข้าท่า'],
    ['กำลังเรียกเข้าท่า', 'เริ่มขึ้น/ลงของ'], ['กำลังขึ้น/ลงของ', 'ปิดงาน'],
  ], x, 1.9, W - MX - x, [2.1, 1.73], 13);
  s.addNotes('บอร์ดคิวคือหน้าที่ทีมคลังเปิดค้างไว้ทั้งวัน ปุ่มสีเขียวคือขั้นถัดไปเสมอ ปุ่มรอง: ไม่มา เรียกซ้ำ ยกเลิกการเรียก (ให้คันอื่นเข้าก่อน) สวิตช์เรียกอัตโนมัติด้านบน ถ้าเปิด ระบบเรียกคันถัดไปที่เช็คอินแล้วทันทีที่ท่าว่าง');
}

{
  const s = light(S3);
  head(s, 'บอร์ดคิว', 'ปิดงาน และลงชื่อ 2 ฝ่าย');
  shot(s, 'whm/14-complete', MX, 1.9, 7.6, 4.75, { alt: 'หน้าต่างปิดงานพร้อมกล่องลายเซ็น 2 ฝ่าย' });
  const x = MX + 7.6 + 0.4;
  const w = W - MX - x;
  steps(s, ['กด ปิดงาน', 'ตรวจชื่อ ทั้งสองฝ่าย', 'เซ็นด้วยนิ้ว หรือปากกา', 'กด ลงชื่อและปิดงาน'], x, 1.95, w, 2.6, 17);
  callout(s, [{ text: 'ลายเซ็นพิมพ์บนใบ DO', options: { breakLine: true } }, { text: 'ไม่สะดวก กด ปิดงานโดยไม่ลงชื่อ' }], x, 4.8, w, 1.2);
  s.addNotes('การลงชื่อไม่บังคับ แต่แนะนำให้ทำทุกคันเป็นหลักฐาน ช่องที่มีลายเซ็นต้องมีชื่อผู้ลงชื่อ ปิดงานแล้วท่าว่าง ระบบเรียกคิวถัดไปถ้าเปิดเรียกอัตโนมัติ ใช้ได้ดีบน iPad หรือแท็บเล็ตหน้าท่า');
}

{
  const s = light(S3);
  shot(s, 'whm/15-walkin', MX, 0.5, 4.4, 6.5, { frame: COL.bg2, alt: 'หน้าต่าง Walk-in' });
  const x = 5.6;
  const w = W - MX - x;
  head(s, 'บอร์ดคิว · หน้า SO / PO', 'Walk-in รถมาถึง โดยไม่ได้จอง', x, w);
  steps(s, ['กด Walk-in (หรือรูปรถที่แถวเอกสาร)', 'เลือก SO / PO ของรถคันนั้น', 'เลือกประเภทรถ กรอกทะเบียน คนขับ', 'แตะช่องเวลา แล้วกด สร้างคิว + เช็คอิน'], x, 1.9, w, 2.4, 17);
  [['ว่าง เลือกได้', '14A35C', 'FFFFFF', 1.9], ['เต็ม', 'C9D2CC', COL.ink, 1.0], ['ต่อท้าย เกินเวลาทำการ', 'F2B263', COL.ink, 2.6]].reduce((px, [t, f, c, pw]) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: px, y: 4.5, w: pw, h: 0.5, rectRadius: 0.25, fill: { color: f }, line: { type: 'none' } });
    s.addText(t, { x: px, y: 4.5, w: pw, h: 0.5, fontSize: 13, bold: true, color: c, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    return px + pw + 0.2;
  }, x);
  s.addText('ต้องผูกเอกสารเสมอ · ใช้ได้เฉพาะวันนี้ · ท่าว่าง ระบบเรียกเข้าท่าทันที', { x, y: 5.3, w, h: 0.9, fontSize: 14, color: COL.body, margin: 0, valign: 'top', isTextBox: true });
  s.addNotes('Walk-in รวมการจอง ออก DO และเช็คอินไว้ในขั้นตอนเดียว ฝ่ายขายและจัดซื้อใช้จากปุ่มรูปรถที่แถวเอกสาร คลังใช้จากบอร์ดคิว ช่องต่อท้าย (ส้ม) โผล่เฉพาะเมื่อเวลาทำการเต็ม เวลาเป็นเวลาโดยประมาณ คลังต้องพร้อมทำงานเกินเวลาปิด SO ที่ยังไม่ชำระ Walk-in จะเป็นรอยืนยันก่อน');
}

{
  const s = light(S3);
  shot(s, 'whm/12-schedule-board', MX, 0.5, 6.0, 6.5, { frame: COL.bg2, alt: 'หน้าต่างจัดตารางคิว มุมมองบอร์ดแบบลาก' });
  const x = 7.2;
  const w = W - MX - x;
  head(s, 'คิวรับ-ส่งสินค้า', 'จัดตารางคิว เลื่อนวัน เวลา ท่า', x, w);
  steps(s, ['เปิดรายละเอียดคิว กด จัดตารางคิว', 'เลือกวัน จากแถบด้านบน', 'แตะช่องว่าง หรือ ลากบล็อกไปท่าอื่น', 'ตรวจสรุป แล้วกด บันทึก'], x, 2.0, w, 2.8, 16);
  s.addText('ระบบไม่ให้ซ้อนคิวบนท่าเดียวกัน · ข้ามวัน = เลขคิวใหม่ แต่ DO และลิงก์คนขับเดิม', { x, y: 5.0, w, h: 1.2, fontSize: 14, color: COL.body, margin: 0, valign: 'top', isTextBox: true });
  s.addNotes('มี 2 มุมมองสลับได้ เลือกช่องเวลา (ตาราง เวลา x ท่า เหมาะกับมือใหม่) และบอร์ด (ลาก) ลากขอบล่างของบล็อกเพื่อยืดหรือหดเวลาที่ท่า บล็อกสีแดงคือชนคิวอื่น ปุ่มบันทึกจะปิด คู่ค้าได้แจ้งเตือนทาง LINE เมื่อคิวถูกเลื่อน');
}

{
  const s = light(S3);
  head(s, 'แนวปฏิบัติ', 'เมื่อไม่เป็นไปตามนัด ทำอย่างไร');
  table(s, ['กรณี', 'ระบบทำให้', 'เจ้าหน้าที่ทำ'], [
    ['รถมาช้า', 'เลยเวลาเผื่อ เป็น เลยเวลานัด แจ้งคนขับ', 'มาถึงแล้ว กด รถมาถึงแล้ว'],
    ['รถไม่มา', 'เลยเวลาเผื่อ 2 เท่า เป็น ไม่มา', 'หรือกด ไม่มา เอง'],
    ['เรียกแล้วไม่เข้า', 'เกินเวลาที่ตั้งไว้ ถือว่าไม่มา', 'เรียกซ้ำ / ยกเลิกการเรียก'],
    ['ท่าล่าช้า', 'แจ้งคนขับ 1 ครั้ง ให้รอในลาน', 'เร่งปิดงานคิวที่ค้าง'],
    ['ขอเลื่อน', 'ตรวจช่องใหม่ไม่ซ้อน', 'ใช้ จัดตารางคิว'],
    ['ทะเบียนไม่ตรง', 'เก็บทั้งทะเบียนจอง และทะเบียนจริง', 'กด แก้ทะเบียน'],
    ['SO ยังไม่ชำระ', 'คิวค้างที่ รอยืนยัน', 'แจ้งฝ่ายขาย บันทึกชำระ'],
  ], MX, 1.9, CW, [2.6, 5.0, 4.23], 15);
  s.addNotes('ค่าเริ่มต้น: เวลาเผื่อ 30 นาที เรียกแล้วไม่เข้าท่า 15 นาที ผู้จัดการคลังปรับได้ที่ตั้งค่าระบบคิว คู่ค้ายกเลิกเองจากลิงก์ได้ก่อนรถมาถึง คลังยกเลิกแทนได้แต่ต้องระบุเหตุผล');
}

{
  const s = light(S3, COL.bg2);
  head(s, 'จอคิว · หน้าคนขับ', 'เรียกเข้าท่าแล้ว คนขับรู้ 2 ทาง');
  s.addImage({ path: path.join(SHOTS, 'whm/18-tv.png'), x: MX, y: 1.9, w: 7.4, h: 4.16, altText: 'จอ TV หน้าลาน' });
  s.addText([{ text: 'จอ TV หน้าลาน', options: { bold: true, color: COL.head } }, { text: ' · เมนู จอคิว มี URL แยกต่อสาขา · แตะจอ 1 ครั้งเพื่อเปิดเสียง' }],
    { x: MX, y: 6.2, w: 7.4, h: 0.5, fontSize: 13, color: COL.body, margin: 0, isTextBox: true });
  shot(s, 'whm/d3-driver-called', 8.7, 1.9, 2.15, 4.2, { alt: 'หน้าคนขับ ถึงคิวแล้ว เชิญเข้าท่า' });
  s.addText([{ text: 'มือถือคนขับ', options: { bold: true, color: COL.head, breakLine: true } }, { text: 'ลิงก์ ไม่ต้องล็อกอิน' }],
    { x: 11.0, y: 1.95, w: W - MX - 11.0, h: 1.2, fontSize: 13, color: COL.body, margin: 0, valign: 'top', isTextBox: true });
  s.addNotes('จอ TV ไม่ต้องล็อกอิน อัปเดตเองทุก 5 วินาที ไม่แสดงเบอร์โทร URL ทุกสาขาในจอเดียวใช้กับห้องควบคุมเท่านั้น หน้าคนขับมีปุ่ม ฉันมาถึงแล้ว เช็คอิน ระบบตรวจว่าอยู่ในรัศมีคลัง และมีปุ่มเปิดแจ้งเตือนบนมือถือสำหรับคนขับที่ไม่ใช้ LINE');
}

// ─────────────── Section 4: management ───────────────
divider('ผู้จัดการ · ผู้บริหาร · Admin', 'ช่วงที่ 4', 'ผู้จัดการ ผู้บริหาร และผู้ดูแลระบบ', 'KPI คลัง · ส่งออกข้อมูล · พนักงานและสิทธิ์ · ก่อนเปิดใช้งาน',
  'ผู้บริหารดูอย่างเดียว แก้ข้อมูลไม่ได้ ผู้จัดการคลังตั้งค่าคลังได้ (ประเภทรถ ท่า เวลาทำการ วันหยุด คู่ค้า ตั้งค่าระบบคิว) แต่จัดการพนักงานและสิทธิ์ไม่ได้ ส่วนนั้นเป็นของผู้ดูแลระบบ');
const S4 = 'ผู้จัดการ · ผู้บริหาร · Admin';

{
  const s = light(S4);
  head(s, 'แดชบอร์ด', 'KPI คลัง อ่านอย่างไร');
  wideShotWithFacts(s, 'whm/01-dashboard', 'แดชบอร์ด KPI คลัง', [
    ['เวลาที่ท่า', 'เริ่มขึ้น/ลงของ ถึงปิดงาน เทียบแผน'],
    ['คิวล่าช้า', 'แยก คลังเริ่มช้า กับ รถมาสาย'],
    ['เวลารวมในคลัง', 'รอในลาน · ตอบรับการเรียก · ขึ้น/ลงของ'],
    ['Export', 'Excel หรือ CSV ตามตัวกรองที่เลือก'],
  ]);
  s.addNotes('ตัวกรองด้านบน: ช่วงเวลา สาขา และขาออก/ขาเข้า มีผลกับทั้ง 2 แท็บและไฟล์ export ลูกศรเขียว/แดงคือเทียบกับช่วงก่อนหน้า ไฟล์ Excel มีแผ่น KPI คลัง ท่า เวลาตามประเภทรถ คิวล่าช้า และภาพรวมคิว ตัวเลขบนภาพเป็นข้อมูลตัวอย่าง');
}

{
  const s = light(S4);
  head(s, 'ผู้ดูแลระบบ', 'พนักงาน และสิทธิ์ 4 ระดับ');
  shot(s, 'admin/02-staff', MX, 1.9, 7.6, 4.75, { alt: 'หน้าพนักงาน' });
  const x = MX + 7.6 + 0.4;
  table(s, ['ระดับ', 'ใช้กับ'], [['admin', 'ผู้ดูแลระบบ'], ['manager', 'ผู้จัดการคลัง'], ['staff', 'ขาย จัดซื้อ แอดมินคลัง'], ['viewer', 'ผู้บริหาร (ดูอย่างเดียว)']],
    x, 1.9, W - MX - x, [1.3, 2.53], 14);
  s.addNotes('เพิ่มพนักงานที่ปุ่ม เพิ่มพนักงาน ระบบส่งอีเมลเชิญ พนักงาน 1 คนมี 1 สิทธิ์ แท็บ สิทธิ์และเมนู กำหนดระดับ เมนูที่เห็น สาขาที่เข้าถึง และสิทธิ์ส่งออกข้อมูล สร้างสิทธิ์ใหม่เองได้ เช่น ป้อมยาม เห็นแค่บอร์ดคิว ต้องเหลือ admin อย่างน้อย 1 คน คนลาออกให้ปิดบัญชีทันที');
}

{
  const s = light(S4);
  head(s, 'ผู้ดูแลระบบ · ผู้จัดการคลัง', 'ตรวจ 9 ข้อ ก่อนเปิดใช้งานจริง');
  steps(s, ['ข้อมูลคลัง: ชื่อ ที่อยู่ เบอร์ โลโก้', 'สาขา: รหัส พิกัด รัศมีเช็คอิน', 'ประเภทรถ และ ท่ารับ–ส่งสินค้า', 'เวลาทำการ และ วันหยุด', 'ตั้งค่าระบบคิว: เวลาเผื่อ เรียกอัตโนมัติ', 'สิทธิ์และเมนู ของแต่ละบทบาท', 'พนักงาน: ทุกคนตั้งรหัสผ่านแล้ว', 'LINE OA และ ERP (ถ้าใช้)', 'ทดสอบ 1 รอบ: SO ถึง ปิดงาน'], MX, 1.95, 7.0, 4.9, 16);
  const x = 8.4;
  const w = W - MX - x;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.95, w, h: 2.7, rectRadius: 0.12, fill: { color: COL.card }, line: { color: COL.line, width: 0.75 } });
  s.addText('ความปลอดภัย', { x: x + 0.25, y: 2.1, w: w - 0.5, h: 0.5, fontSize: 16, bold: true, color: COL.head, margin: 0, isTextBox: true });
  const sec = ['บัญชีของตัวเอง ไม่ใช้ร่วม', 'ห้ามส่งต่ออีเมลเชิญ', 'คนพ้นหน้าที่ ปิดบัญชีทันที', 'ให้สิทธิ์เท่าที่จำเป็น'];
  s.addText(sec.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < sec.length - 1 } })), { x: x + 0.25, y: 2.65, w: w - 0.5, h: 1.85, fontSize: 13, color: COL.body, paraSpaceAfter: 4, margin: 0, valign: 'top', isTextBox: true });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.9, w, h: 1.7, rectRadius: 0.12, fill: { color: COL.brand }, line: { type: 'none' } });
  s.addText([{ text: 'ประวัติการใช้งาน', options: { bold: true, color: COL.lime, breakLine: true } }, { text: 'ทุกการเพิ่ม แก้ ลบ ถูกบันทึก ตรวจย้อนหลังได้', options: { color: COL.onDark } }],
    { x: x + 0.25, y: 5.05, w: w - 0.5, h: 1.4, fontSize: 14, paraSpaceAfter: 6, margin: 0, valign: 'middle', isTextBox: true });
  s.addNotes('ลำดับนี้สำคัญ เพราะท่าและเวลาทำการผูกกับสาขา ต้องมีสาขาก่อน ข้อ 9 ให้ทำจริงทุกขั้นกับเอกสารทดสอบ แล้วลบเอกสารทดสอบ เมนูประวัติการใช้งานดูได้เฉพาะผู้ดูแลระบบ');
}

// ─────────────── Section 5: LINE + practice ───────────────
divider('LINE และฝึกปฏิบัติ', 'ช่วงที่ 5', 'LINE OA และ ฝึกปฏิบัติ', 'แจ้งเตือนคู่ค้าและคนขับ · กลุ่ม WMS ของทีมคลัง',
  'ใครมี LINE บนมือถือ ให้เพิ่มเพื่อน OA ของคลังตอนนี้เลย เพื่อใช้ในช่วงฝึกปฏิบัติ');
const S5 = 'LINE และฝึกปฏิบัติ';

{
  const s = light(S5, COL.bg2);
  shot(s, 'line/l4-confirmed', MX, 0.5, 3.25, 6.5, { frame: '8FA9D3', alt: 'การ์ด LINE ยืนยันคิวรับสินค้าแล้ว' });
  shot(s, 'line/l5-my-queues', MX + 3.5, 0.5, 3.25, 6.5, { frame: '8FA9D3', alt: 'เมนู LINE คิวของฉัน' });
  const x = 8.0;
  const w = W - MX - x;
  head(s, 'LINE OA · คู่ค้า และคนขับ', 'แจ้งเตือนอัตโนมัติ ทุกครั้งที่คิวเปลี่ยน', x, w);
  steps(s, ['เพิ่มเพื่อน OA @307ghkbr', 'เปิดลิงก์จอง ผ่าน LINE 1 ครั้ง', 'รับการ์ด: รับคำขอ · ยืนยัน + DO · ถึงคิว', 'เมนู: คิวของฉัน · สถานะ SO · ติดต่อคลัง'], x, 2.3, w, 3.0, 16);
  s.addText('OA ตอบอัตโนมัติ ไม่มีคนอ่านแชท', { x, y: 5.6, w, h: 0.5, fontSize: 14, color: COL.body, margin: 0, isTextBox: true });
  s.addNotes('ขั้น 2 สำคัญที่สุด การเปิดลิงก์ผ่าน LINE ครั้งแรกคือการผูกบัญชี ถ้าเปิดใน Chrome หรือ Safari ยังจองได้แต่ไม่ได้แจ้งเตือน ให้กดแถบเปิดใน LINE คนขับได้แจ้งเตือนเมื่อเปิดลิงก์คนขับผ่าน LINE และเป็นเพื่อนกับ OA พิมพ์ คิว SO หรือ ติดต่อ ในแชทได้ผลเหมือนกดเมนู');
}

{
  const s = light(S5);
  shot(s, 'line/g2-feed', MX, 0.5, 3.3, 6.5, { frame: '8FA9D3', alt: 'กลุ่ม LINE WMS ของทีมคลัง' });
  const x = 4.6;
  const w = W - MX - x;
  head(s, 'LINE · ทีมคลัง', 'กลุ่ม WMS รู้ทันที ไม่ต้องเปิดระบบค้าง', x, w);
  table(s, ['ข้อความ', 'ทีมหน้างานทำ'], [
    ['คิวใหม่รอยืนยัน', 'ตรวจ แล้วอนุมัติ'], ['SO ชำระแล้ว', 'อนุมัติคิวที่ค้างได้เลย'], ['รถมาถึง', 'เตรียมท่า'],
    ['เรียกอัตโนมัติ', 'รับรถเข้าท่า'], ['เลยเวลานัด / ไม่มา', 'โทรตามคนขับ'], ['ทะเบียนไม่ตรง', 'ตรวจรถที่ประตู'],
  ], x, 2.0, w, [3.4, w - 3.4], 15);
  s.addNotes('ผู้ดูแลระบบเชิญ OA เข้ากลุ่ม แล้วพิมพ์ ลงทะเบียนกลุ่ม ในกลุ่ม 1 ครั้ง ใช้กลุ่มนี้เป็นช่องแจ้งเตือนเท่านั้น คุยงานในกลุ่มอื่น แผนฟรีของ LINE ส่งได้ 200 ข้อความต่อเดือน ถ้าปริมาณคิวมาก ต้องพิจารณาแพ็กเกจ LINE');
}

{
  const s = light(S5);
  head(s, 'ฝึกปฏิบัติ 30 นาที', 'ทำ 1 คิวจริง ส่งไม้ต่อกันทั้งห้อง');
  const groups = [
    ['ฝ่ายขาย', ['คีย์ SO-TEST ยังไม่ชำระ', 'ส่งลิงก์ให้เพื่อน', 'บันทึกชำระแล้ว'], '0B7A47'],
    ['ลูกค้า (สมมติ)', ['เปิดลิงก์ผ่าน LINE', 'จองคิว', 'เปลี่ยนทะเบียนรถ'], '2563C9'],
    ['ทีมคลัง', ['อนุมัติ + DO', 'เช็คอิน · เรียกเข้าท่า', 'ปิดงาน + ลงชื่อ'], '7E3AA8'],
    ['ผู้จัดการ', ['ดูคิวบนแดชบอร์ด', 'Export Excel', 'ลองทำ Walk-in 1 คัน'], 'D08A12'],
  ];
  const cw = (CW - 0.3 * 3) / 4;
  groups.forEach(([t, items, c], i) => {
    const x = MX + i * (cw + 0.3);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.95, w: cw, h: 3.4, rectRadius: 0.12, fill: { color: COL.card }, line: { color: COL.line, width: 0.75 } });
    s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: 2.22, w: 0.22, h: 0.22, fill: { color: c }, line: { type: 'none' } });
    s.addText(t, { x: x + 0.6, y: 2.08, w: cw - 0.85, h: 0.5, fontSize: 16, bold: true, color: COL.head, margin: 0, isTextBox: true });
    s.addText(items.map((it, j) => ({ text: it, options: { bullet: true, breakLine: j < items.length - 1 } })), { x: x + 0.25, y: 2.75, w: cw - 0.5, h: 2.4, fontSize: 14, color: COL.body, paraSpaceAfter: 6, margin: 0, valign: 'top', isTextBox: true });
  });
  s.addText('สังเกตระหว่างทำ: กลุ่ม WMS · จอ TV · การ์ด LINE ของลูกค้า ขึ้นตามลำดับหรือไม่', { x: MX, y: 5.75, w: CW, h: 0.5, fontSize: 15, color: COL.body, margin: 0, isTextBox: true });
  s.addNotes('ใช้เอกสารชื่อขึ้นต้น SO-TEST เพื่อลบทิ้งง่ายหลังอบรม ลองให้คลังกดอนุมัติก่อนฝ่ายขายบันทึกชำระ เพื่อให้เห็นว่าระบบไม่ยอม แล้วค่อยบันทึกชำระ ถ้ามีเวลาเหลือ ลองเลื่อนคิวด้วยจัดตารางคิว และลองปุ่มแจ้งปัญหามุมซ้ายล่าง');
}

{
  const s = pres.addSlide({ sectionTitle: S5 });
  s.background = { color: COL.brand };
  s.addText('เจอปัญหา ทำอย่างไร', { x: MX, y: 0.8, w: CW, h: 0.6, fontSize: 22, bold: true, color: COL.lime, margin: 0, isTextBox: true });
  s.addText('กดปุ่มวงกลมสีเขียว มุมซ้ายล่าง ทุกหน้า', { x: MX, y: 1.45, w: CW, h: 1.6, fontSize: 40, bold: true, color: 'F4FAF6', margin: 0, valign: 'top', isTextBox: true });
  const cw = (CW - 0.4 * 2) / 3;
  [['แจ้งปัญหา', 'ระบบแนบภาพหน้าจอให้เอง เขียนว่าทำอะไร แล้วเกิดอะไร'], ['คู่มือ', 'PDF 7 เล่ม แยกตามบทบาท'], ['ติดต่อทีม', '[ชื่อผู้ประสานงาน] · [LINE / เบอร์โทร]']].forEach(([t, b], i) => {
    const x = MX + i * (cw + 0.4);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 3.4, w: cw, h: 2.0, rectRadius: 0.12, fill: { color: '0C3A2A' }, line: { color: '2E5C47', width: 1 } });
    s.addText(t, { x: x + 0.3, y: 3.55, w: cw - 0.6, h: 0.5, fontSize: 17, bold: true, color: COL.mint, margin: 0, isTextBox: true });
    s.addText(b, { x: x + 0.3, y: 4.1, w: cw - 0.6, h: 1.15, fontSize: 14, color: COL.onDark, margin: 0, valign: 'top', isTextBox: true });
  });
  s.addText('ถาม–ตอบ', { x: MX, y: 6.0, w: CW, h: 0.7, fontSize: 26, bold: true, color: 'F4FAF6', margin: 0, isTextBox: true });
  s.addNotes('เปิดถามตอบ จดคำถามที่ตอบไม่ได้ไว้ตามต่อ แจกคู่มือ PDF ตามบทบาท ความต้องการใหม่นอกขอบเขตเดิม ให้แจ้งผ่านผู้ประสานงาน เพื่อประเมินเป็น Change Request ไม่ใช่สั่งแก้ผ่านปุ่มแจ้งปัญหา');
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log('wrote', OUT);
})();
