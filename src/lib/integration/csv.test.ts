import { describe, expect, it } from 'vitest';
import { normalizeCsvDate, parseDocumentsCsv } from './csv';

describe('normalizeCsvDate', () => {
  it('reads common formats and Buddhist years', () => {
    expect(normalizeCsvDate('2026-09-21')).toBe('2026-09-21');
    expect(normalizeCsvDate('21/09/2026')).toBe('2026-09-21');
    expect(normalizeCsvDate('1/9/2569')).toBe('2026-09-01');
    expect(normalizeCsvDate('2026/9/5 00:00')).toBe('2026-09-05');
    expect(normalizeCsvDate('garbage')).toBe('');
    expect(normalizeCsvDate('32/13/2026')).toBe('');
  });
});

describe('parseDocumentsCsv', () => {
  it('groups item lines into documents', () => {
    const csv = '﻿doc_no,customer_code,customer_name,phone,due_date,sku,item_name,qty,uom\n'
      + 'SO-001,C01,บจก. เอ,0811111111,21/09/2026,P1,ปูน,"1,200",ถุง\n'
      + 'SO-001,C01,บจก. เอ,0811111111,21/09/2026,P2,เหล็ก,50,เส้น\n'
      + 'SO-002,C02,บจก. บี,,,,,,\n';
    const r = parseDocumentsCsv(csv);
    expect(r.missingColumns).toEqual([]);
    expect(r.errors).toEqual([]);
    expect(r.documents).toHaveLength(2);
    expect(r.documents[0]).toMatchObject({ doc_no: 'SO-001', due_date: '2026-09-21', partner: { code: 'C01', name: 'บจก. เอ' } });
    expect(r.documents[0].items).toEqual([{ sku: 'P1', name: 'ปูน', qty: 1200, uom: 'ถุง' }, { sku: 'P2', name: 'เหล็ก', qty: 50, uom: 'เส้น' }]);
    expect(r.documents[1].items).toEqual([]);
  });

  it('accepts Thai headers', () => {
    const r = parseDocumentsCsv('เลขที่เอกสาร,ชื่อผู้ขาย,สินค้า,จำนวน\nPO-9,หจก. ซี,ทราย,3\n');
    expect(r.documents[0]).toMatchObject({ doc_no: 'PO-9', partner: { name: 'หจก. ซี' }, items: [{ name: 'ทราย', qty: 3 }] });
  });

  it('reports missing columns and bad rows without throwing', () => {
    expect(parseDocumentsCsv('foo,bar\n1,2\n').missingColumns).toEqual(['doc_no', 'partner_name']);
    const r = parseDocumentsCsv('doc_no,partner_name,item_name,qty\n,เอ,x,1\nSO-3,,x,1\nSO-4,ดี,x,-2\n');
    expect(r.documents).toEqual([]);
    expect(r.errors.map((e) => [e.line, e.doc_no])).toEqual([[2, null], [3, 'SO-3'], [4, 'SO-4']]);
  });
});
