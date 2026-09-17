export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type AppRole = 'super_admin' | 'shop_owner' | 'branch_manager' | 'staff' | 'customer';
/**
 * Statuses the app actually drives. The DB enum also holds `seating`,
 * `in_service` and `skipped` (migration 202605110001) which nothing sets yet;
 * `src/lib/booking/status-meta.ts` still presents them.
 */
export type BookingStatus =
  | 'pending'
  | 'pending_approval'
  | 'confirmed'
  | 'checked_in'
  | 'waiting'
  | 'called'
  | 'serving'
  | 'completed'
  | 'cancelled'
  | 'no_show';
/**
 * Payment lifecycle of a booking.
 *
 * `awaiting_verification` and `rejected` only occur on the bank-transfer path,
 * where a customer-uploaded slip must be reviewed by shop staff. The Omise
 * PromptPay path goes straight from `pending_payment` to `paid` via webhook.
 */
export type PaymentStatus =
  | 'unpaid'
  | 'pending_payment'
  | 'awaiting_verification'
  | 'paid'
  | 'rejected'
  | 'failed'
  | 'refunded';

/**
 * How a booking is being paid for. Null on bookings with no payment.
 *
 * Two methods open a bank app; the bank itself lives in `bookings.bank_provider`
 * and the link to open in `bookings.bank_deeplink_url`:
 * - `bank_deeplink` — direct bank API (SCB Easy / K PLUS partner APIs), money
 *   settles into the shop's own bank account.
 * - `omise_mobile_banking` — Omise Mobile Banking source; the link is Omise's
 *   `authorize_uri`, the charge id lives in `omise_charge_id` and money settles
 *   into the shop's Omise account like `omise_promptpay`.
 */
export type PaymentMethod = 'omise_promptpay' | 'omise_mobile_banking' | 'bank_transfer' | 'bank_deeplink';

/** Source of truth for zod enums and method-picker ordering. */
export const PAYMENT_METHODS = ['omise_promptpay', 'omise_mobile_banking', 'bank_transfer', 'bank_deeplink'] as const satisfies readonly PaymentMethod[];

/**
 * Every Thai bank app a customer can be sent to, in LIFF button order.
 * Superset of `BankProvider`: Omise Mobile Banking serves all five, the direct
 * bank APIs only the two in `BANK_PROVIDERS`.
 */
export const BANK_CODES = ['kbank', 'scb', 'bay', 'bbl', 'ktb'] as const;
export type BankCode = (typeof BANK_CODES)[number];

/** Bank whose app a direct-API (`bank_deeplink`) payment opens. */
export type BankProvider = 'scb' | 'kbank';

/** Source of truth for zod enums and the per-bank button order in LIFF (direct bank APIs only). */
export const BANK_PROVIDERS = ['scb', 'kbank'] as const satisfies readonly BankProvider[];

/** Review state of an uploaded transfer slip. */
export type SlipStatus = 'pending' | 'approved' | 'rejected' | 'superseded';

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}
