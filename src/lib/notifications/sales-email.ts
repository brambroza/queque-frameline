type SalesEmail = {
  subject: string;
  html: string;
  /** Overrides SALES_NOTIFY_EMAIL / SIGNUP_NOTIFY_EMAIL for this message. */
  to?: string;
};

/**
 * Last-resort recipient, kept only so notifications do not silently vanish when
 * the env is unset. TODO: set SALES_NOTIFY_EMAIL to a company mailbox and drop
 * this — a personal address reads as pre-revenue to a prospect who sees it.
 */
const FALLBACK_NOTIFY_EMAIL = 'amnart.gl@gmail.com';

/** Where inbound sales signals land when no per-message recipient is given. */
export function resolveSalesRecipient(explicit?: string): string {
  return explicit ?? process.env.SALES_NOTIFY_EMAIL ?? process.env.SIGNUP_NOTIFY_EMAIL ?? FALLBACK_NOTIFY_EMAIL;
}

function resolveRecipient(explicit?: string): string {
  return resolveSalesRecipient(explicit);
}

async function sendViaSmtp(email: SalesEmail): Promise<boolean> {
  const host = process.env.SMTP_HOST ?? 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT ?? 465);
  const secure = String(process.env.SMTP_SECURE ?? 'true') === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM_EMAIL ?? user;
  const to = resolveRecipient(email.to);

  if (!user || !pass || !from) return false;

  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.default.createTransport({ host, port, secure, auth: { user, pass } });
  await transporter.sendMail({ from, to, subject: email.subject, html: email.html });
  return true;
}

/** Sender Resend accepts without a verified domain (delivers only to the account owner). */
const RESEND_DEFAULT_FROM = 'QueueBooking <onboarding@resend.dev>';

async function postResend(apiKey: string, from: string, to: string, email: SalesEmail): Promise<Response> {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject: email.subject, html: email.html }),
  });
}

async function sendViaResend(email: SalesEmail): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? RESEND_DEFAULT_FROM;
  const to = resolveRecipient(email.to);

  if (!apiKey) return false;

  let res = await postResend(apiKey, from, to, email);

  // 403 "domain is not verified": the configured sender domain is not set up in
  // Resend yet. Retry with Resend's shared sender so the lead still lands.
  if (res.status === 403 && from !== RESEND_DEFAULT_FROM) {
    const detail = await res.text();
    if (detail.includes('not verified')) {
      console.warn(`[sales-email] resend sender "${from}" not verified, retrying with ${RESEND_DEFAULT_FROM}`);
      res = await postResend(apiKey, RESEND_DEFAULT_FROM, to, email);
    } else {
      console.warn(`[sales-email] resend failed 403: ${detail}`);
      return false;
    }
  }

  if (!res.ok) {
    console.warn(`[sales-email] resend failed ${res.status}: ${await res.text()}`);
    return false;
  }
  return true;
}

/**
 * Sends an internal sales/ops notification. SMTP first, Resend as fallback.
 * Never throws — a failed notification must not break the user-facing flow it
 * was triggered from.
 */
export async function sendSalesEmail(email: SalesEmail): Promise<boolean> {
  try {
    if (await sendViaSmtp(email)) return true;
  } catch (err) {
    console.warn('[sales-email] smtp failed, falling back to resend:', err);
  }

  try {
    return await sendViaResend(email);
  } catch (err) {
    console.warn('[sales-email] resend failed:', err);
    return false;
  }
}

/** Renders a label/value table for internal notification emails. */
export function buildDetailTable(title: string, rows: Array<[string, string | null | undefined]>): string {
  const cells = rows
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 10px 4px 0"><b>${label}</b></td><td>${String(value)}</td></tr>`
    )
    .join('');

  return `
  <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
    <h2 style="margin:0 0 12px">${title}</h2>
    <table style="border-collapse:collapse">${cells}</table>
  </div>
  `;
}
