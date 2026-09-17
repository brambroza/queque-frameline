import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { writeAuditLog } from '@/lib/audit/activity-log';
import { isValidLiffId, normalizeLiffId } from '@/lib/line/liff-id';
import { isBookingEchoEnabled } from '@/lib/line/booking-echo';
import { getReminderSettings, REMINDER_PRESETS } from '@/lib/line/booking-reminder';

const PatchSchema = z.object({
  line_channel_access_token: z.string().trim().max(500).optional().nullable(),
  line_channel_secret: z.string().trim().max(200).optional().nullable(),
  liff_id: z.string().trim().max(200).optional().nullable(),
  liff_id_login_shop: z.string().trim().max(200).optional().nullable(),
  auto_reply_enabled: z.boolean().optional(),
  booking_echo_enabled: z.boolean().optional(),
  reminder_enabled: z.boolean().optional(),
  // Only the portal presets are accepted; the DB range is wider on purpose.
  reminder_minutes: z
    .number()
    .int()
    .refine((v) => (REMINDER_PRESETS as readonly number[]).includes(v), { message: 'reminder_minutes ต้องเป็นค่าที่ระบบกำหนดไว้' })
    .optional(),
});

export async function GET() {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const { data, error } = await supabase
      .from('shops')
      .select('id,name,shop_key,line_channel_access_token,line_channel_secret,liff_id,liff_id_login_shop,auto_reply_enabled')
      .eq('id', profile.shop_id)
      .single();
    if (error) throw error;
    // Read separately so a not-yet-migrated column cannot blank the whole page.
    const [bookingEchoEnabled, reminder] = await Promise.all([
      isBookingEchoEnabled(supabase, profile.shop_id as string),
      getReminderSettings(supabase, profile.shop_id as string),
    ]);
    return NextResponse.json({
      data: { ...data, booking_echo_enabled: bookingEchoEnabled, reminder_enabled: reminder.enabled, reminder_minutes: reminder.minutes },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner'] });
    const body = PatchSchema.parse(await req.json());

    // Accept a pasted LIFF URL and store the bare ID. Saving the URL verbatim
    // used to succeed and then break booking with no visible cause.
    const liffId = normalizeLiffId(body.liff_id);
    const liffIdLoginShop = normalizeLiffId(body.liff_id_login_shop);

    for (const [label, value] of [
      ['LIFF ID (จองคิว)', liffId],
      ['LIFF ID (สมาชิก)', liffIdLoginShop],
    ] as const) {
      if (value && !isValidLiffId(value)) {
        return NextResponse.json(
          { error: `${label} ไม่ถูกต้อง — ต้องอยู่ในรูปแบบ 1234567890-abcdefgh` },
          { status: 400 }
        );
      }
    }

    const { data: beforeShop } = await supabase
      .from('shops')
      .select('id,line_channel_access_token,line_channel_secret,liff_id,liff_id_login_shop,auto_reply_enabled')
      .eq('id', profile.shop_id)
      .maybeSingle();

    const { error } = await supabase
      .from('shops')
      .update({
        line_channel_access_token: body.line_channel_access_token ?? null,
        line_channel_secret: body.line_channel_secret ?? null,
        liff_id: liffId || null,
        liff_id_login_shop: liffIdLoginShop || null,
        auto_reply_enabled: Boolean(body.auto_reply_enabled),
        updated_by: user.id,
      })
      .eq('id', profile.shop_id);
    if (error) throw error;

    // Kept out of the update above on purpose: the column ships in migration
    // 202608240002, and a missing column must not block a token change.
    let bookingEchoEnabled: boolean | null = null;
    if (body.booking_echo_enabled !== undefined) {
      const { error: echoError } = await supabase
        .from('shops')
        .update({ booking_echo_enabled: body.booking_echo_enabled, updated_by: user.id })
        .eq('id', profile.shop_id);
      if (echoError) console.error('[line_settings_booking_echo_failed]', echoError.message);
      else bookingEchoEnabled = body.booking_echo_enabled;
    }

    // Same isolation for the reminder columns (migration 202609120004).
    let reminderAfter: { enabled: boolean; minutes: number } | null = null;
    if (body.reminder_enabled !== undefined || body.reminder_minutes !== undefined) {
      const patch: Record<string, unknown> = { updated_by: user.id };
      if (body.reminder_enabled !== undefined) patch.reminder_enabled = body.reminder_enabled;
      if (body.reminder_minutes !== undefined) patch.reminder_minutes = body.reminder_minutes;
      const { error: reminderError } = await supabase.from('shops').update(patch).eq('id', profile.shop_id);
      if (reminderError) console.error('[line_settings_reminder_failed]', reminderError.message);
      else reminderAfter = await getReminderSettings(supabase, profile.shop_id as string);
    }

    await writeAuditLog({
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      action: 'line_settings_token_changed',
      targetTable: 'shops',
      targetId: profile.shop_id ?? null,
      payload: {
        before: {
          liff_id: beforeShop?.liff_id ?? null,
          liff_id_login_shop: beforeShop?.liff_id_login_shop ?? null,
          auto_reply_enabled: beforeShop?.auto_reply_enabled ?? null,
          has_line_channel_access_token: Boolean(beforeShop?.line_channel_access_token),
          has_line_channel_secret: Boolean(beforeShop?.line_channel_secret),
        },
        after: {
          liff_id: liffId || null,
          liff_id_login_shop: liffIdLoginShop || null,
          auto_reply_enabled: Boolean(body.auto_reply_enabled),
          booking_echo_enabled: bookingEchoEnabled,
          reminder_enabled: reminderAfter?.enabled ?? null,
          reminder_minutes: reminderAfter?.minutes ?? null,
          has_line_channel_access_token: Boolean(body.line_channel_access_token),
          has_line_channel_secret: Boolean(body.line_channel_secret),
        },
      },
    });

    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
