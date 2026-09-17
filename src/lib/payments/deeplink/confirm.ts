import type { SupabaseClient } from '@supabase/supabase-js';
import { safeCreateNotification } from '@/lib/notifications/createNotification';
import { pushPaymentReceipt } from '@/lib/payments/receipt';
import { getDeeplinkAdapter, parseBankProvider } from './registry';
import { loadShopDeeplinkProvider, providerCacheKey } from './settings';
import type { InquiryResult } from './types';

export type ConfirmOutcome =
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
  bank_provider: string | null;
  bank_txn_id: string | null;
  bank_txn_ref: string | null;
}

function toSatang(amount: number) {
  return Math.round(amount * 100);
}

/**
 * Verify a deeplink payment with the bank and, if paid, mark the booking.
 *
 * Shared by the bank webhook and the customer-facing polling routes, so a
 * confirmation the bank never delivered (dev URL unreachable, outage) is healed
 * the next time the customer's screen asks for status.
 *
 * Never trusts a callback body: the bank's inquiry API is the only source of
 * truth, the amount is compared in satang, and the final update is conditional
 * on the row still being `pending_payment` so two concurrent confirmations
 * cannot both push a receipt.
 */
export async function confirmDeeplinkPayment(
  admin: SupabaseClient,
  opts: { shopId: string; bookingId: string },
): Promise<ConfirmOutcome> {
  const { data: bookingData } = await admin
    .from('bookings')
    .select('id, shop_id, company_id, queue_number, payment_status, payment_method, payment_amount, bank_provider, bank_txn_id, bank_txn_ref')
    .eq('id', opts.bookingId)
    .eq('shop_id', opts.shopId)
    .maybeSingle();
  const booking = bookingData as BookingRow | null;
  if (!booking) return 'not_found';
  if (booking.payment_status === 'paid') return 'already_paid';

  const provider = parseBankProvider(booking.bank_provider);
  if (booking.payment_method !== 'bank_deeplink' || !provider || (!booking.bank_txn_id && !booking.bank_txn_ref)) {
    return 'not_found';
  }

  const config = await loadShopDeeplinkProvider(admin, booking.shop_id, provider, { includeDisabled: true });
  if (!config) return 'provider_error';

  const adapter = getDeeplinkAdapter(provider);
  let inquiry: InquiryResult;
  try {
    inquiry = await adapter.inquireTransaction(
      config,
      { transactionId: booking.bank_txn_id, ref1: booking.bank_txn_ref },
      providerCacheKey(config),
    );
  } catch (e) {
    console.error('[deeplink] inquiry failed:', e instanceof Error ? e.message : 'unknown');
    return 'provider_error';
  }

  const auditBase = {
    company_id: booking.company_id,
    shop_id: booking.shop_id,
    booking_id: booking.id,
    method: 'bank_deeplink',
    provider,
    provider_txn_id: inquiry.transactionId || booking.bank_txn_id,
    amount: Number(booking.payment_amount ?? 0),
    currency: 'THB',
  };

  if (inquiry.status === 'pending') return 'still_pending';

  if (inquiry.status === 'failed' || inquiry.status === 'expired') {
    await admin.from('payment_transactions').insert({
      ...auditBase,
      status: inquiry.status,
      event_type: `deeplink.${inquiry.status}`,
      raw_event: inquiry.raw,
    });
    if (inquiry.status === 'failed') {
      await admin
        .from('bookings')
        .update({ payment_status: 'failed' })
        .eq('id', booking.id)
        .eq('shop_id', booking.shop_id)
        .eq('payment_status', 'pending_payment');
    }
    return inquiry.status;
  }

  // Paid at the bank. Guard the amount before touching the booking.
  const expected = toSatang(Number(booking.payment_amount ?? 0));
  if (inquiry.amountTHB !== null && toSatang(inquiry.amountTHB) !== expected) {
    await admin.from('payment_transactions').insert({
      ...auditBase,
      status: 'mismatch',
      event_type: 'deeplink.amount_mismatch',
      note: `bank reported ${inquiry.amountTHB} THB, booking expects ${Number(booking.payment_amount ?? 0)} THB`,
      raw_event: inquiry.raw,
    });
    await safeCreateNotification(admin, {
      companyId: booking.company_id,
      shopId: booking.shop_id,
      type: 'payment_amount_mismatch',
      category: 'billing',
      priority: 'high',
      title: 'ยอดชำระไม่ตรงกับการจอง',
      message: `คิว ${booking.queue_number}: ธนาคารแจ้งยอด ${inquiry.amountTHB} บาท แต่การจองต้องชำระ ${Number(booking.payment_amount ?? 0)} บาท กรุณาตรวจสอบ`,
      relatedType: 'booking',
      relatedId: booking.id,
      actionUrl: `/portal/bookings?booking_id=${booking.id}`,
      icon: 'alert',
      color: 'amber',
    });
    return 'amount_mismatch';
  }

  const paidAt = inquiry.paidAt ?? new Date().toISOString();
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
    event_type: 'deeplink.confirmed',
    raw_event: inquiry.raw,
  });

  const receiptRef = `RCP-${provider.toUpperCase()}-${(booking.bank_txn_ref ?? booking.id.slice(0, 8)).toUpperCase()}`;
  await pushPaymentReceipt(admin, { bookingId: booking.id, shopId: booking.shop_id, receiptRef, paidAt });

  return 'paid';
}
