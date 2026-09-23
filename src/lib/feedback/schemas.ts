/**
 * Zod contract of `POST /api/feedback` plus the pure screenshot decoder.
 * The screenshot travels as a JPEG/PNG data URL produced client-side; the
 * decoded size is bounded so a single report can never exceed the bucket
 * limit or the request body budget.
 */
import { z } from 'zod';
import {
  FEEDBACK_CC_MAX,
  FEEDBACK_DESCRIPTION_MAX,
  FEEDBACK_DESCRIPTION_MIN,
  FEEDBACK_KINDS,
  FEEDBACK_NAME_MAX,
  FEEDBACK_PHONE_MAX,
  FEEDBACK_PRIORITIES,
  FEEDBACK_SCREENSHOT_MAX_BYTES,
} from './constants';

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** True for a plausible single e-mail address (no spaces, one `@`, a dot in the domain). */
export function isEmailAddress(v: string): boolean {
  return EMAIL_RE.test(v);
}

/**
 * Split a comma/semicolon/newline separated list of e-mail addresses.
 * Trims, lower-cases, de-duplicates and keeps input order. Returns `invalid`
 * entries separately so the form can point at the bad one.
 */
export function parseEmailList(value: string | null | undefined): { emails: string[]; invalid: string[] } {
  const emails: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const raw of (value ?? '').split(/[,;\n]/)) {
    const item = raw.trim();
    if (!item) continue;
    if (!isEmailAddress(item)) {
      invalid.push(item);
      continue;
    }
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    emails.push(key);
  }
  return { emails, invalid };
}

const DATA_URL_RE = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/;

export type ParsedScreenshot = { buffer: Buffer; mime: 'image/jpeg' | 'image/png'; ext: 'jpg' | 'png' };

/** Decoded byte length of a base64 payload without materialising it. */
export function base64ByteLength(b64: string): number {
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

/**
 * Decode an `image/jpeg|png` base64 data URL. Returns null when the value is
 * not a supported data URL or the decoded image is larger than the cap.
 */
export function parseScreenshotDataUrl(value: string | null | undefined): ParsedScreenshot | null {
  if (!value) return null;
  const m = DATA_URL_RE.exec(value);
  if (!m) return null;
  const mime = m[1] as ParsedScreenshot['mime'];
  const b64 = m[2];
  if (base64ByteLength(b64) > FEEDBACK_SCREENSHOT_MAX_BYTES) return null;
  return { buffer: Buffer.from(b64, 'base64'), mime, ext: mime === 'image/png' ? 'png' : 'jpg' };
}

/** Portal path the report was filed from (`/portal` or `/portal/...`), query string allowed. */
const portalPath = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((p) => p === '/portal' || p.startsWith('/portal/') || p.startsWith('/portal?'), 'page_path must be a portal path');

export const feedbackReportSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  priority: z.enum(FEEDBACK_PRIORITIES),
  reporter_name: z.string().trim().min(1).max(FEEDBACK_NAME_MAX),
  /** Reply-to address typed in the form; empty = use the sign-in e-mail. */
  contact_email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => !v || isEmailAddress(v), 'contact_email must be an e-mail address'),
  /** Comma-separated CC list; parsed into `cc_emails`. */
  cc: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .nullable()
    .transform((v) => parseEmailList(v))
    .refine((r) => r.invalid.length === 0, 'cc contains an invalid e-mail address')
    .refine((r) => r.emails.length <= FEEDBACK_CC_MAX, `cc may list at most ${FEEDBACK_CC_MAX} addresses`)
    .transform((r) => r.emails),
  contact_phone: z
    .string()
    .trim()
    .max(FEEDBACK_PHONE_MAX)
    .optional()
    .nullable()
    .transform((v) => v || null)
    .refine((v) => !v || /^[0-9+()\-\s]{6,}$/.test(v), 'contact_phone must be a phone number'),
  description: z.string().trim().min(FEEDBACK_DESCRIPTION_MIN).max(FEEDBACK_DESCRIPTION_MAX),
  page_path: portalPath,
  page_label: z.string().trim().max(120).optional().nullable(),
  /** Data URL (`data:image/jpeg;base64,...`); validated + size-checked by `parseScreenshotDataUrl`. */
  screenshot: z
    .string()
    .max(Math.ceil((FEEDBACK_SCREENSHOT_MAX_BYTES * 4) / 3) + 64)
    .optional()
    .nullable()
    .refine((v) => !v || parseScreenshotDataUrl(v) !== null, 'screenshot must be a JPEG/PNG data URL under the size limit'),
  user_agent: z.string().trim().max(500).optional().nullable(),
  viewport: z.string().trim().max(40).optional().nullable(),
  branch_id: z.string().uuid().optional().nullable(),
});

export type FeedbackReportInput = z.infer<typeof feedbackReportSchema>;
