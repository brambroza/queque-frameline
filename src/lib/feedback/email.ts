/**
 * Pure builder of the feedback notification e-mail (subject + text + HTML).
 * No I/O, no secrets: everything it renders comes from the validated report
 * and a few non-sensitive context values.
 */
import {
  FEEDBACK_KIND_LABEL,
  FEEDBACK_PRIORITY_LABEL,
  type FeedbackKind,
  type FeedbackPriority,
} from './constants';

export type FeedbackEmailReport = {
  id: string;
  kind: FeedbackKind;
  priority: FeedbackPriority;
  reporter_name: string;
  /** Reply-to address from the form (null = sign-in e-mail). */
  contact_email?: string | null;
  contact_phone?: string | null;
  cc_emails?: string[] | null;
  description: string;
  page_path: string;
  page_label?: string | null;
  user_agent?: string | null;
  viewport?: string | null;
  created_at: Date;
};

export type FeedbackEmailContext = {
  /** Public base URL of the deployment, used to build the absolute page link. */
  appUrl: string;
  /** Sign-in e-mail of the reporter (from the session, not the form). */
  reporterEmail?: string | null;
  /** Access level of the reporter (admin / staff). */
  reporterRole?: string | null;
  /** Site / shop display name for the subject prefix. */
  siteName?: string | null;
  /** Set when a screenshot is attached inline as `cid:<screenshotCid>`. */
  screenshotCid?: string | null;
  appVersion?: string | null;
};

export type BuiltEmail = { subject: string; text: string; html: string };

const KIND_TAG: Record<FeedbackKind, string> = { bug: 'BUG', suggestion: 'แนะนำ' };

/** Escape the five HTML-significant characters. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** First line of the description, trimmed to `max` characters with an ellipsis. */
export function summarize(description: string, max = 60): string {
  const first = description.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? '';
  return first.length > max ? `${first.slice(0, max - 1)}…` : first;
}

/** Absolute URL of the page the report came from. */
export function pageUrl(appUrl: string, pagePath: string): string {
  return `${appUrl.replace(/\/+$/, '')}${pagePath.startsWith('/') ? pagePath : `/${pagePath}`}`;
}

function formatBangkok(d: Date): string {
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/** Build subject/text/html for one feedback report. */
export function buildFeedbackEmail(report: FeedbackEmailReport, ctx: FeedbackEmailContext): BuiltEmail {
  const site = ctx.siteName?.trim() || 'Fameline Queue';
  const kindTh = FEEDBACK_KIND_LABEL[report.kind].th;
  const prioTh = FEEDBACK_PRIORITY_LABEL[report.priority].th;
  const page = report.page_label?.trim() || report.page_path;
  const url = pageUrl(ctx.appUrl, report.page_path);
  const when = formatBangkok(report.created_at);

  const subject = `[${site}][${KIND_TAG[report.kind]}][${prioTh}] ${page} — ${summarize(report.description)}`;

  const rows: Array<[string, string]> = [
    ['ประเภท', kindTh],
    ['ความสำคัญ', prioTh],
    ['ผู้แจ้ง', report.reporter_name],
    ['อีเมลติดต่อกลับ', report.contact_email ?? ctx.reporterEmail ?? '-'],
    ['เบอร์โทร', report.contact_phone ?? '-'],
    ['CC', report.cc_emails?.length ? report.cc_emails.join(', ') : '-'],
    ['บัญชีที่ login', ctx.reporterEmail ?? '-'],
    ['สิทธิ์', ctx.reporterRole ?? '-'],
    ['เมนู', page],
    ['URL', url],
    ['เวลาแจ้ง', `${when} (Asia/Bangkok)`],
    ['เบราว์เซอร์', report.user_agent ?? '-'],
    ['ขนาดจอ', report.viewport ?? '-'],
    ['เวอร์ชันแอป', ctx.appVersion ?? '-'],
    ['Report ID', report.id],
  ];

  const text = [
    `${kindTh} — ${prioTh}`,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    'รายละเอียด:',
    report.description,
    '',
    ctx.screenshotCid ? 'ภาพหน้าจอแนบมากับอีเมลนี้ (ไฟล์ screenshot)' : 'ไม่มีภาพหน้าจอแนบ',
  ].join('\n');

  const tableRows = rows
    .map(([k, v]) => {
      const cell = k === 'URL' ? `<a href="${escapeHtml(v)}">${escapeHtml(v)}</a>` : escapeHtml(v);
      return `<tr><td style="padding:4px 12px 4px 0;color:#64748b;white-space:nowrap;vertical-align:top">${escapeHtml(k)}</td><td style="padding:4px 0">${cell}</td></tr>`;
    })
    .join('');

  const html = [
    '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#0f172a;line-height:1.5">',
    `<h2 style="margin:0 0 4px;font-size:18px">${escapeHtml(kindTh)} <span style="font-weight:400;color:#64748b">· ${escapeHtml(prioTh)}</span></h2>`,
    `<p style="margin:0 0 12px;color:#64748b">${escapeHtml(site)}</p>`,
    `<table style="border-collapse:collapse;margin-bottom:12px">${tableRows}</table>`,
    '<h3 style="margin:12px 0 4px;font-size:15px">รายละเอียด</h3>',
    `<pre style="white-space:pre-wrap;font-family:inherit;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin:0 0 12px">${escapeHtml(report.description)}</pre>`,
    ctx.screenshotCid
      ? `<h3 style="margin:12px 0 4px;font-size:15px">ภาพหน้าจอ</h3><img src="cid:${escapeHtml(ctx.screenshotCid)}" alt="screenshot" style="max-width:100%;border:1px solid #e2e8f0;border-radius:8px" />`
      : '<p style="color:#64748b">ไม่มีภาพหน้าจอแนบ</p>',
    '</div>',
  ].join('');

  return { subject, text, html };
}
