/**
 * Pure helpers for the ERP push API: request limits, per-item normalisation
 * before validation, and the per-request summary written to `integration_logs`.
 */
import type { ZodError } from 'zod';

/** Documents per request. Sequential upserts of ~5 queries each must fit a Vercel function's budget. */
export const API_MAX_DOCUMENTS = 100;
/** Request body cap in bytes. */
export const API_MAX_BODY_BYTES = 1024 * 1024;
/** Failed items kept on the log row. */
export const MAX_LOGGED_FAILURES = 50;

export type DocumentFailureCode = 'validation_error' | 'unknown_branch' | 'has_live_bookings' | 'branch_locked' | 'db_error';

export type DocumentResult =
  | { doc_no: string | null; status: 'created' | 'updated' | 'valid'; id?: string; warnings?: string[] }
  | { doc_no: string | null; status: 'failed'; code: DocumentFailureCode; message: string; fields?: string[] };

export type BatchStatus = 'ok' | 'partial' | 'failed';

export type BatchSummary = {
  received: number;
  created: number;
  updated: number;
  failed: number;
  status: BatchStatus;
  /** Capped at `MAX_LOGGED_FAILURES`; never carries the payload. */
  failures: Array<{ index: number; doc_no: string | null; code: DocumentFailureCode; message: string }>;
};

/** Read the `doc_no` off an unvalidated item, for error reporting only. */
export function peekDocNo(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = (raw as { doc_no?: unknown }).doc_no;
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, 60) : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Tidy one ERP item so a single bad line does not sink the whole document:
 * drop item lines with a non-positive quantity or no name (the ERP should
 * already have skipped delivered / cancelled / service lines), drop a
 * malformed partner email. Everything else is left for Zod to judge.
 */
export function normalizeApiItem(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const item = { ...(raw as Record<string, unknown>) };

  if (Array.isArray(item.items)) {
    item.items = item.items
      .filter((line) => line && typeof line === 'object' && !Array.isArray(line))
      .map((line) => {
        const l = { ...(line as Record<string, unknown>) };
        const name = typeof l.name === 'string' ? l.name.trim() : '';
        const sku = typeof l.sku === 'string' ? l.sku.trim() : '';
        if (!name && sku) l.name = sku;
        // "1,200" from a formatted export → 1200; Zod's coerce would read it as NaN.
        if (typeof l.qty === 'string') l.qty = Number(l.qty.replace(/,/g, '').trim());
        return l;
      })
      .filter((l) => {
        const qty = Number(l.qty);
        const name = typeof l.name === 'string' ? l.name.trim() : '';
        return Number.isFinite(qty) && qty > 0 && name.length > 0;
      });
  }

  if (item.partner && typeof item.partner === 'object' && !Array.isArray(item.partner)) {
    const p = { ...(item.partner as Record<string, unknown>) };
    if (typeof p.email === 'string' && p.email.trim() && !EMAIL_RE.test(p.email.trim())) delete p.email;
    item.partner = p;
  }

  return item;
}

/** First few Zod issues as `path: message`, plus the distinct paths. */
export function formatZodIssues(error: ZodError): { message: string; fields: string[] } {
  const fields = Array.from(new Set(error.issues.map((i) => i.path.join('.') || 'row')));
  const message = error.issues.slice(0, 3).map((i) => `${i.path.join('.') || 'row'}: ${i.message}`).join('; ');
  return { message, fields };
}

/** Counts + overall status for one request. */
export function summarizeBatch(results: DocumentResult[]): BatchSummary {
  let created = 0;
  let updated = 0;
  const failures: BatchSummary['failures'] = [];
  results.forEach((r, index) => {
    if (r.status === 'created') created += 1;
    else if (r.status === 'updated') updated += 1;
    else if (r.status === 'failed' && failures.length < MAX_LOGGED_FAILURES) failures.push({ index, doc_no: r.doc_no, code: r.code, message: r.message });
  });
  const failed = results.filter((r) => r.status === 'failed').length;
  const status: BatchStatus = failed === 0 ? 'ok' : failed === results.length ? 'failed' : 'partial';
  return { received: results.length, created, updated, failed, status, failures };
}
