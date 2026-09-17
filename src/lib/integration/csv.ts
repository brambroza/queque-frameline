/**
 * CSV → SO / PO documents.
 *
 * One line per item; lines sharing a `doc_no` form one document (header fields
 * are taken from the first line of the group). Header names are matched
 * loosely (case, spaces, Thai aliases) because every ERP exports differently.
 *
 * Required: doc_no, partner_name.  Optional: partner_code, partner_phone,
 * partner_email, doc_date, due_date, remark, sku, item_name, qty, uom.
 */
import Papa from 'papaparse';
import { documentUpsertSchema, type DocumentUpsert } from '@/lib/integration/schemas';

export const CSV_MAX_ROWS = 5000;

const ALIASES: Record<string, string[]> = {
  doc_no: ['doc_no', 'docno', 'document_no', 'so_no', 'po_no', 'sono', 'pono', 'order_no', 'เลขที่เอกสาร', 'เลขที่', 'เลขที่ใบสั่งขาย', 'เลขที่ใบสั่งซื้อ'],
  partner_code: ['partner_code', 'customer_code', 'vendor_code', 'supplier_code', 'cust_code', 'รหัสลูกค้า', 'รหัสผู้ขาย', 'รหัสคู่ค้า'],
  partner_name: ['partner_name', 'customer_name', 'vendor_name', 'supplier_name', 'customer', 'supplier', 'ชื่อลูกค้า', 'ชื่อผู้ขาย', 'ชื่อคู่ค้า', 'ลูกค้า', 'ผู้ขาย'],
  partner_phone: ['partner_phone', 'phone', 'tel', 'mobile', 'เบอร์โทร', 'โทรศัพท์', 'โทร'],
  partner_email: ['partner_email', 'email', 'อีเมล'],
  doc_date: ['doc_date', 'date', 'order_date', 'วันที่เอกสาร', 'วันที่'],
  due_date: ['due_date', 'delivery_date', 'ship_date', 'วันที่ส่ง', 'วันที่กำหนดส่ง', 'กำหนดส่ง'],
  remark: ['remark', 'note', 'remarks', 'หมายเหตุ'],
  sku: ['sku', 'item_code', 'product_code', 'รหัสสินค้า'],
  item_name: ['item_name', 'product_name', 'item', 'product', 'description', 'ชื่อสินค้า', 'สินค้า', 'รายการ'],
  qty: ['qty', 'quantity', 'จำนวน'],
  uom: ['uom', 'unit', 'หน่วย', 'หน่วยนับ'],
};

const norm = (h: string) => h.replace(/^﻿/, '').trim().toLowerCase().replace(/[\s.\-]+/g, '_');

function mapHeaders(headers: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of headers) {
    const key = norm(h);
    for (const [field, names] of Object.entries(ALIASES)) {
      if (!out[field] && names.some((n) => norm(n) === key)) out[field] = h;
    }
  }
  return out;
}

/** `21/09/2026`, `21-09-2026`, `2026/09/21`, Buddhist years → `YYYY-MM-DD`; '' when unreadable. */
export function normalizeCsvDate(raw: string | undefined): string {
  const v = (raw ?? '').trim();
  if (!v) return '';
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(v);
  let y: number, mo: number, d: number;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; } else {
    m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(v);
    if (!m) return '';
    d = +m[1]; mo = +m[2]; y = +m[3];
  }
  if (y > 2400) y -= 543;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export type CsvRowError = { line: number; doc_no: string | null; message: string };
export type CsvParseResult = { documents: DocumentUpsert[]; errors: CsvRowError[]; rowCount: number; missingColumns: string[] };

/**
 * @param text Raw CSV text (UTF-8, BOM tolerated).
 * @returns Valid documents plus per-line errors; never throws on bad data.
 */
export function parseDocumentsCsv(text: string): CsvParseResult {
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: 'greedy' });
  const headers = parsed.meta.fields ?? [];
  const map = mapHeaders(headers);
  const missingColumns = ['doc_no', 'partner_name'].filter((f) => !map[f]);
  const rows = parsed.data.slice(0, CSV_MAX_ROWS);
  if (missingColumns.length > 0) return { documents: [], errors: [], rowCount: rows.length, missingColumns };

  const get = (row: Record<string, string>, field: string) => (map[field] ? String(row[map[field]] ?? '').trim() : '');
  const groups = new Map<string, { firstLine: number; rows: Array<{ line: number; row: Record<string, string> }> }>();
  const errors: CsvRowError[] = [];

  rows.forEach((row, idx) => {
    const line = idx + 2; // header is line 1
    const docNo = get(row, 'doc_no');
    if (!docNo) { errors.push({ line, doc_no: null, message: 'ไม่มีเลขที่เอกสาร' }); return; }
    const g = groups.get(docNo) ?? { firstLine: line, rows: [] };
    g.rows.push({ line, row });
    groups.set(docNo, g);
  });

  const documents: DocumentUpsert[] = [];
  for (const [docNo, g] of groups) {
    const head = g.rows[0].row;
    const items = g.rows
      .filter(({ row }) => get(row, 'item_name') || get(row, 'sku'))
      .map(({ row }) => ({
        sku: get(row, 'sku'),
        name: get(row, 'item_name') || get(row, 'sku'),
        qty: get(row, 'qty').replace(/,/g, '') || '1',
        uom: get(row, 'uom'),
      }));
    const candidate = {
      doc_no: docNo,
      partner: { code: get(head, 'partner_code'), name: get(head, 'partner_name'), phone: get(head, 'partner_phone'), email: get(head, 'partner_email') },
      doc_date: normalizeCsvDate(get(head, 'doc_date')),
      due_date: normalizeCsvDate(get(head, 'due_date')),
      remark: get(head, 'remark'),
      items,
    };
    const result = documentUpsertSchema.safeParse(candidate);
    if (result.success) documents.push(result.data);
    else {
      const first = result.error.issues[0];
      errors.push({ line: g.firstLine, doc_no: docNo, message: `${first.path.join('.') || 'row'}: ${first.message}` });
    }
  }
  return { documents, errors, rowCount: rows.length, missingColumns: [] };
}
