import type { SupabaseClient } from '@supabase/supabase-js';
import { safeCreateNotification } from '@/lib/notifications/createNotification';
import { pushPaymentReceipt } from '@/lib/payments/receipt';
import { resolveOmiseSecretKey, retrieveCharge, type OmiseCharge } from './omise';

export type OmiseConfirmOutcome =
  | 'paid'
  | 'already_paid'
  | 'still_pending'
  | 'failed'
  | 'expired'
  | 'amount_mismatch'
  | 'not_found'
  | 'provider_error';

interface BookingRow {
  id: string;
  shop_id: string;
  company_id: string;
  queue_number: string;
  payment_status: string | null;
  payment_method: string | null;
  payment_amount: number | null;
  omise_charge_id: string | null;
  bank_provider: string | null;
  shops: { omise_secret_key: string | null } | { omise_secret_key: string | null }[] | null;
}

const OMISE_METHODS = new Set(['omise_promptpay', 'omise_mobile_banking']);

function toSatang(amount: number) {
  return Math.round(amount * 100);
}

/** Receipt reference shown to the customer; derived from the charge id so it is stable across retries. */
export function omiseReceiptRef(chargeId: string): string {
  return chargeId.replace('chrg_', 'RCP-').toUpperCase();
}

/**
 * Ask Omise for the charge on a booking and, if paid, mark the booking.
 *
 * Shared by the Omise webhook and the customer-facing polling routes, so a
 * `charge.complete` the webhook never received (unreachable dev URL, outage)
 * is healed the next time the customer's screen asks for status.
 *
 * Never trusts a webhook body: the charge is re-fetched with the shop's key,
 * the amount is compared in satang, and the final update is conditional on the
 * row still being `pending_payment` so two concurrent confirmations cannot both
 * push a receipt.
 */
export async function confirmOmiseCharge(
  admin: SupabaseClient,
  opts: { shopId: string; bookingId: string },
): Promise<OmiseConfirmOutcome> {
  const { data: bookingData } = await admin
    .from('bookings')
    .select('id, shop_id, company_id, queue_number, payment_status, payment_method, payment_amount, omise_charge_id, bank_provider, shops(omise_secret_key)')
    .eq('id', opts.bookingId)
    .eq('shop_id', opts.shopId)
    .maybeSingle();
  const booking = bookingData as unknown as BookingRow | null;
  if (!booking) return 'not_found';
  if (booking.payment_status === 'paid') return 'already_paid';
  if (!OMISE_METHODS.has(String(booking.payment_method)) || !booking.omise_charge_id) return 'not_found';

  const shop = Array.isArray(booking.shops) ? booking.shops[0] : booking.shops;
  const secretKey = resolveOmiseSecretKey(shop?.omise_secret_key ?? null);
  if (!secretKey) return 'provider_error';

  let charge: OmiseCharge;
  try {
    charge = await retrieveCharge(booking.omise_charge_id, secretKey);
  } catch (e) {
    console.error('[omise] retrieve failed:', e instanceof Error ? e.message : 'unknown');
    return 'provider_error';
  }

  const auditBase = {
    company_id: booking.company_id,
    shop_id: booking.shop_id,
    booking_id: booking.id,
    method: booking.payment_method,
    provider: booking.bank_provider,
    omise_charge_id: charge.id,
    amount: Number(booking.payment_amount ?? 0),
    currency: 'THB',
  };
  const rawEvent = charge as unknown as Record<string, unknown>;

  if (charge.status === 'pending') return 'still_pending';

  if (charge.status === 'failed' || charge.status === 'expired' || charge.status === 'reversed') {
    const outcome = charge.status === 'expired' ? 'expired' : 'failed';
    await admin.from('payment_transactions').insert({
      ...auditBase,
      status: charge.status,
      event_type: `charge.${charge.status}`,
      note: charge.failure_code ? `${charge.failure_code}: ${charge.failure_message ?? ''}`.trim() : null,
      raw_event: rawEvent,
    });
    if (outcome === 'failed') {
      // Expiry keeps `pending_payment`: the countdown already tells the customer
      // and re-issuing simply makes a new charge.
      await admin
        .from('bookings')
        .update({ payment_status: 'failed' })
        .eq('id', booking.id)
        .eq('shop_id', booking.shop_id)
        .eq('payment_status', 'pending_payment');
    }
    return outcome;
  }

  // Paid at Omise. Guard the amount before touching the booking.
  const expected = toSatang(Number(booking.payment_amount ?? 0));
  if (charge.amount !== expected) {
    const chargedTHB = charge.amount / 100;
    await admin.from('payment_transactions').insert({
      ...auditBase,
      status: 'mismatch',
      event_type: 'charge.amount_mismatch',
      note: `Omise charged ${chargedTHB} THB, booking expects ${Number(booking.payment_amount ?? 0)} THB`,
      raw_event: rawEvent,
    });
    await safeCreateNotification(admin, {
      companyId: booking.company_id,
      shopId: booking.shop_id,
      type: 'payment_amount_mismatch',
      category: 'billing',
      priority: 'high',
      title: 'ยอดชำระไม่ตรงกับการจอง',
      message: `คิว ${booking.queue_number}: Omise แจ้งยอด ${chargedTHB} บาท แต่การจองต้องชำระ ${Number(booking.payment_amount ?? 0)} บาท กรุณาตรวจสอบ`,
      relatedType: 'booking',
      relatedId: booking.id,
      actionUrl: `/portal/bookings?booking_id=${booking.id}`,
      icon: 'alert',
      color: 'amber',
    });
    return 'amount_mismatch';
  }

  const paidAt = charge.paid_at ?? new Date().toISOString();
  const { data: updated } = await admin
    .from('bookings')
    .update({ payment_status: 'paid', paid_at: paidAt, payment_verified_at: paidAt })
    .eq('id', booking.id)
    .eq('shop_id', booking.shop_id)
    .eq('payment_status', 'pending_payment')
    .select('id');

  // Zero rows: a concurrent confirmation won the race and already sent the receipt.
  if (!updated || updated.length === 0) return 'already_paid';

  await admin.from('payment_transactions').insert({
    ...auditBase,
    status: 'successful',
    event_type: 'charge.complete',
    raw_event: rawEvent,
  });

  await pushPaymentReceipt(admin, { bookingId: booking.id, shopId: booking.shop_id, receiptRef: omiseReceiptRef(charge.id), paidAt });

  return 'paid';
}
