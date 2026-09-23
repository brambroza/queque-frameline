/**
 * Outbound e-mail over SMTP (nodemailer). Optional integration: when the
 * `SMTP_*` env is blank every send is skipped and reported as
 * `mail_not_configured` — callers must never let that break the business flow.
 *
 * Credentials are read from env only and never logged.
 */
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
  /** Set to reference the attachment inline from HTML as `cid:<cid>`. */
  cid?: string;
};

export type MailMessage = {
  to: string | string[];
  cc?: string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
  replyTo?: string;
};

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

/** Short, safe reason codes exposed to callers / stored in the DB. */
export type MailFailure = 'mail_not_configured' | 'smtp_failed';

export type SafeSendResult = { ok: true; messageId: string | null } | { ok: false; error: MailFailure };

/**
 * Read the SMTP settings from env. Returns null unless host, user, pass and
 * from address are all present — half-configured SMTP counts as disabled.
 */
export function getSmtpConfig(env: Record<string, string | undefined> = process.env): SmtpConfig | null {
  const host = env.SMTP_HOST?.trim();
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS ?? '';
  const from = env.SMTP_FROM_EMAIL?.trim() || user;
  if (!host || !user || !pass || !from) return null;
  const port = Number.parseInt(env.SMTP_PORT ?? '587', 10);
  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 587,
    secure: (env.SMTP_SECURE ?? 'false').toLowerCase() === 'true',
    user,
    pass,
    from,
  };
}

/** True when a send would actually go out. */
export function isMailConfigured(): boolean {
  return getSmtpConfig() !== null;
}

let cached: { key: string; transporter: Transporter } | null = null;

function getTransporter(cfg: SmtpConfig): Transporter {
  const key = `${cfg.host}:${cfg.port}:${cfg.secure}:${cfg.user}`;
  if (cached && cached.key === key) return cached.transporter;
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  cached = { key, transporter };
  return transporter;
}

/**
 * Send one message. Throws when SMTP is not configured or the send fails;
 * prefer `safeSendMail` from request handlers.
 */
export async function sendMail(message: MailMessage): Promise<{ messageId: string | null }> {
  const cfg = getSmtpConfig();
  if (!cfg) throw new Error('mail_not_configured');
  const transporter = getTransporter(cfg);
  const info = await transporter.sendMail({
    from: cfg.from,
    to: message.to,
    cc: message.cc?.length ? message.cc : undefined,
    subject: message.subject,
    text: message.text,
    html: message.html,
    replyTo: message.replyTo,
    attachments: message.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
      cid: a.cid,
    })),
  });
  return { messageId: typeof info.messageId === 'string' ? info.messageId : null };
}

/**
 * Send without throwing. Logs a one-line reason (no credentials, no raw
 * SMTP transcript) and returns a short failure code the caller can persist.
 */
export async function safeSendMail(message: MailMessage): Promise<SafeSendResult> {
  if (!getSmtpConfig()) return { ok: false, error: 'mail_not_configured' };
  try {
    const { messageId } = await sendMail(message);
    return { ok: true, messageId };
  } catch (e) {
    const reason = e instanceof Error ? e.message.split('\n')[0].slice(0, 200) : 'unknown';
    console.warn('[mail_failed]', { subject: message.subject.slice(0, 80), reason });
    return { ok: false, error: 'smtp_failed' };
  }
}
