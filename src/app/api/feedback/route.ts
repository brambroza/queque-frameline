import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/lib/audit/activity-log';
import { safeSendMail } from '@/lib/mail/send';
import { env } from '@/lib/utils/env';
import { feedbackReportSchema, parseScreenshotDataUrl } from '@/lib/feedback/schemas';
import { buildFeedbackEmail, pageUrl } from '@/lib/feedback/email';
import { FEEDBACK_SCREENSHOT_BUCKET } from '@/lib/feedback/constants';

/** Screenshot upload + SMTP round-trip can exceed the default budget. */
export const maxDuration = 30;

const SCREENSHOT_CID = 'feedback-screenshot';

/**
 * File a bug report / suggestion from the portal feedback button.
 * Order of operations is deliberate: the row is written first so a report
 * survives a Storage or SMTP failure; both of those are best-effort and only
 * annotate the row (`screenshot_path`, `email_sent_at` / `email_error`).
 */
export async function POST(req: Request) {
  try {
    const { supabase, user, profile, roles } = await requireAuthContext({ roles: ['admin', 'staff'] });
    const parsed = feedbackReportSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    const input = parsed.data;
    const screenshot = parseScreenshotDataUrl(input.screenshot);
    const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || null;
    const reporterRole = roles.includes('admin') ? 'admin' : 'staff';

    const { data: row, error: insertError } = await supabase
      .from('feedback_reports')
      .insert({
        company_id: profile.company_id,
        shop_id: profile.shop_id,
        branch_id: input.branch_id ?? null,
        kind: input.kind,
        priority: input.priority,
        reporter_name: input.reporter_name,
        reporter_email: user.email ?? null,
        reporter_role: reporterRole,
        page_path: input.page_path,
        page_label: input.page_label ?? null,
        page_url: pageUrl(env.appUrl, input.page_path),
        description: input.description,
        user_agent: input.user_agent ?? null,
        viewport: input.viewport ?? null,
        app_version: appVersion,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id, created_at')
      .single();
    if (insertError || !row) {
      // PostgREST errors are plain objects, not Error instances — wrap so the
      // catch below returns a readable message instead of "Unexpected error".
      const reason = insertError?.message ?? 'insert_failed';
      if (insertError?.code === '42P01') {
        throw new Error('ยังไม่ได้รัน migration 202609240001 (feedback_reports)');
      }
      throw new Error(`บันทึกรายงานไม่สำเร็จ: ${reason}`);
    }

    const admin = createAdminClient();

    // Screenshot → private bucket (best-effort; the e-mail still carries the bytes).
    let screenshotPath: string | null = null;
    if (screenshot) {
      const objectPath = `${profile.shop_id}/${row.id}.${screenshot.ext}`;
      const { error: uploadError } = await admin.storage
        .from(FEEDBACK_SCREENSHOT_BUCKET)
        .upload(objectPath, screenshot.buffer, { contentType: screenshot.mime, upsert: true });
      if (uploadError) {
        console.warn('[feedback_screenshot_upload_failed]', { id: row.id, reason: uploadError.message.slice(0, 120) });
      } else {
        screenshotPath = objectPath;
      }
    }

    // E-mail to the product team (best-effort; recipient comes from env only).
    const to = process.env.FEEDBACK_TO_EMAIL?.trim();
    let emailed = false;
    let emailError: string | null = null;
    if (!to) {
      emailError = 'mail_not_configured';
    } else {
      const { data: shop } = await admin.from('shops').select('name').eq('id', profile.shop_id).maybeSingle();
      const mail = buildFeedbackEmail(
        {
          id: row.id,
          kind: input.kind,
          priority: input.priority,
          reporter_name: input.reporter_name,
          description: input.description,
          page_path: input.page_path,
          page_label: input.page_label,
          user_agent: input.user_agent,
          viewport: input.viewport,
          created_at: new Date(row.created_at),
        },
        {
          appUrl: env.appUrl,
          reporterEmail: user.email,
          reporterRole,
          siteName: shop?.name ?? null,
          screenshotCid: screenshot ? SCREENSHOT_CID : null,
          appVersion,
        }
      );
      const sent = await safeSendMail({
        to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        replyTo: user.email ?? undefined,
        attachments: screenshot
          ? [{ filename: `screenshot.${screenshot.ext}`, content: screenshot.buffer, contentType: screenshot.mime, cid: SCREENSHOT_CID }]
          : undefined,
      });
      emailed = sent.ok;
      emailError = sent.ok ? null : sent.error;
    }

    await admin
      .from('feedback_reports')
      .update({
        screenshot_path: screenshotPath,
        email_sent_at: emailed ? new Date().toISOString() : null,
        email_error: emailError,
      })
      .eq('id', row.id)
      .eq('shop_id', profile.shop_id);

    await writeAuditLog({
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      action: 'feedback_submitted',
      targetTable: 'feedback_reports',
      targetId: row.id,
      payload: { kind: input.kind, priority: input.priority, page_path: input.page_path, emailed, screenshot: Boolean(screenshotPath) },
    });

    return NextResponse.json({ data: { id: row.id, emailed, screenshot_saved: Boolean(screenshotPath) } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
