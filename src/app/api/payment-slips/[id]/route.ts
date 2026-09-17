import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { pushMessage } from '@/lib/line/client';
import { paymentReceiptFlex, slipRejectedFlex } from '@/lib/line/messages-payment';
import { safeCreateNotification } from '@/lib/notifications/createNotification';
import { formatThaiDateLabel } from '@/lib/utils/date-format';

const schema = z
  .object({
    action: z.enum(['approve', 'reject']),
    reject_reason: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.action !== 'reject' || Boolean(v.reject_reason), {
    message: 'reject_reason is required when rejecting',
  });

function receiptRef(queueNumber: string) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `RCP-${queueNumber}-${today}`;
}

/** Push a LINE message to a booking's customer. Never throws — a failed push must not undo a decision. */
async function notifyCustomer(
  admin: ReturnType<typeof createAdminClient>,
  shopId: string,
  lineUserPk: string | null,
  messages: object[],
) {
  if (!lineUserPk) return;
  try {
    const [{ data: lineUser }, { data: shopLine }] = await Promise.all([
      admin.from('line_users').select('line_user_id').eq('id', lineUserPk).maybeSingle(),
      admin.from('shops').select('line_channel_access_token').eq('id', shopId).maybeSingle(),
    ]);
    const token = shopLine?.line_channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
    if (!token || !lineUser?.line_user_id) return;
    await pushMessage(token, lineUser.line_user_id, messages);
  } catch (e) {
    console.error('[slip] customer notify failed:', e instanceof Error ? e.message : e);
  }
}

/**
 * Approve or reject one uploaded slip.
 *
 * Plain `staff` is excluded on purpose: confirming that money arrived is a
 * financial decision, not a queue operation.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, user, profile } = await requireAuthContext({
      roles: ['super_admin', 'shop_owner', 'branch_manager'],
    });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    const { action, reject_reason } = parsed.data;

    // Session client + tenant filter: a slip from another shop is simply not found.
    const { data: slip } = await supabase
      .from('payment_slips')
      .select('id,booking_id,status,amount_claimed')
      .eq('id', id)
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .maybeSingle();
    if (!slip) return NextResponse.json({ error: 'Slip not found' }, { status: 404 });

    // Idempotency: a second reviewer acting on the same slip gets a conflict
    // rather than a duplicate transaction row.
    if (slip.status !== 'pending') {
      return NextResponse.json({ error: 'สลิปนี้ถูกตรวจสอบไปแล้ว' }, { status: 409 });
    }

    const { data: booking } = await supabase
      .from('bookings')
      .select('id,queue_number,booking_date,start_time,payment_amount,line_user_id,branches(branch_name),services(service_name)')
      .eq('id', slip.booking_id)
      .eq('shop_id', profile.shop_id)
      .maybeSingle();
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    const admin = createAdminClient();
    const { data: shopRow } = await admin
      .from('shops')
      .select('name,shop_key')
      .eq('id', profile.shop_id)
      .maybeSingle();
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
    const uploadUrl = appUrl && shopRow?.shop_key
      ? `${appUrl}/liff/${encodeURIComponent(shopRow.shop_key)}?tab=account`
      : null;

    const now = new Date().toISOString();
    const amount = Number(booking.payment_amount ?? 0);
    const branchName = (booking.branches as unknown as { branch_name?: string } | null)?.branch_name ?? '-';
    const serviceName = (booking.services as unknown as { service_name?: string } | null)?.service_name ?? '-';

    if (action === 'approve') {
      const { error: slipError } = await admin
        .from('payment_slips')
        .update({ status: 'approved', reviewed_by: user.id, reviewed_at: now, updated_by: user.id })
        .eq('id', slip.id)
        .eq('status', 'pending');
      if (slipError) throw slipError;

      await admin
        .from('bookings')
        .update({
          payment_status: 'paid',
          paid_at: now,
          payment_verified_at: now,
          payment_verified_by: user.id,
          payment_reject_reason: null,
        })
        .eq('id', booking.id)
        .eq('shop_id', profile.shop_id);

      await admin.from('payment_transactions').insert({
        company_id: profile.company_id,
        shop_id: profile.shop_id,
        booking_id: booking.id,
        slip_id: slip.id,
        method: 'bank_transfer',
        amount,
        currency: 'THB',
        status: 'successful',
        event_type: 'slip.approved',
        raw_event: { reviewed_by: user.id, amount_claimed: slip.amount_claimed },
        created_by: user.id,
      });

      await admin.from('booking_logs').insert({
        company_id: profile.company_id,
        shop_id: profile.shop_id,
        booking_id: booking.id,
        action: 'payment_slip_approved',
        description: `Slip approved for ${booking.queue_number} (${amount} THB)`,
        created_by: user.id,
      });

      await safeCreateNotification(admin, {
        companyId: profile.company_id,
        shopId: profile.shop_id,
        type: 'payment_verified',
        category: 'billing',
        title: 'ยืนยันการชำระเงินแล้ว',
        message: `คิว ${booking.queue_number} ชำระ ${amount.toLocaleString('th-TH')} บาท เรียบร้อย`,
        relatedType: 'booking',
        relatedId: booking.id,
        createdBy: user.id,
      });

      await notifyCustomer(admin, profile.shop_id, booking.line_user_id, [
        paymentReceiptFlex({
          shopName: shopRow?.name ?? 'Queue Booking',
          queueNumber: booking.queue_number,
          service: serviceName,
          branch: branchName,
          date: formatThaiDateLabel(String(booking.booking_date)),
          time: String(booking.start_time).slice(0, 5),
          amountTHB: amount,
          receiptRef: receiptRef(booking.queue_number),
          paidAt: now,
        }),
      ]);

      return NextResponse.json({ data: { status: 'approved' } });
    }

    // ── reject ──
    const reason = reject_reason as string;
    const { error: slipError } = await admin
      .from('payment_slips')
      .update({ status: 'rejected', reject_reason: reason, reviewed_by: user.id, reviewed_at: now, updated_by: user.id })
      .eq('id', slip.id)
      .eq('status', 'pending');
    if (slipError) throw slipError;

    await admin
      .from('bookings')
      .update({ payment_status: 'rejected', payment_reject_reason: reason })
      .eq('id', booking.id)
      .eq('shop_id', profile.shop_id);

    await admin.from('payment_transactions').insert({
      company_id: profile.company_id,
      shop_id: profile.shop_id,
      booking_id: booking.id,
      slip_id: slip.id,
      method: 'bank_transfer',
      amount,
      currency: 'THB',
      status: 'failed',
      event_type: 'slip.rejected',
      note: reason,
      raw_event: { reviewed_by: user.id, reason },
      created_by: user.id,
    });

    await admin.from('booking_logs').insert({
      company_id: profile.company_id,
      shop_id: profile.shop_id,
      booking_id: booking.id,
      action: 'payment_slip_rejected',
      description: `Slip rejected for ${booking.queue_number}: ${reason}`,
      created_by: user.id,
    });

    await notifyCustomer(admin, profile.shop_id, booking.line_user_id, [
      slipRejectedFlex({
        shopName: shopRow?.name ?? 'Queue Booking',
        queueNumber: booking.queue_number,
        amountTHB: amount,
        reason,
        uploadUrl,
      }),
    ]);

    return NextResponse.json({ data: { status: 'rejected' } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
