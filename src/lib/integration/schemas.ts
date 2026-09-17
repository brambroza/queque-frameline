/**
 * One shape for SO / PO coming from anywhere: ERP API push, CSV import or the
 * portal form. Whatever the source, the row is validated here before it touches the DB.
 */
import { z } from 'zod';

const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const optText = (max: number) => z.preprocess(blankToUndefined, z.string().trim().max(max).optional());
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

export const documentItemSchema = z.object({
  sku: optText(80),
  name: z.string().trim().min(1).max(300),
  qty: z.coerce.number().positive().max(1_000_000_000),
  uom: optText(30),
});

export const documentPartnerSchema = z.object({
  code: optText(60),
  name: z.string().trim().min(1).max(200),
  phone: optText(30),
  email: z.preprocess(blankToUndefined, z.string().trim().email().max(200).optional()),
});

export const documentUpsertSchema = z.object({
  doc_no: z.string().trim().min(1).max(60),
  partner: documentPartnerSchema,
  doc_date: z.preprocess(blankToUndefined, isoDate.optional()),
  due_date: z.preprocess(blankToUndefined, isoDate.optional()),
  items: z.array(documentItemSchema).max(500).default([]),
  remark: optText(500),
  status: z.enum(['open', 'cancelled']).optional(),
});

export type DocumentUpsert = z.infer<typeof documentUpsertSchema>;
export type DocumentItem = z.infer<typeof documentItemSchema>;

/** Sum of item quantities, or null when there are no items. */
export function totalQty(items: DocumentItem[]): number | null {
  if (items.length === 0) return null;
  return Math.round(items.reduce((sum, i) => sum + i.qty, 0) * 1000) / 1000;
}
