-- Omise Mobile Banking: customer taps a bank button in LIFF, the bank app opens
-- with the amount locked, Omise confirms via the existing charge.complete webhook.
-- Complements 202606300001_qr_payment.sql (Omise PromptPay QR) — same Omise keys.
-- No new booking columns: the charge id reuses omise_charge_id, the bank reuses
-- bank_provider and Omise's authorize_uri reuses bank_deeplink_url.

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS mobile_banking_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.shops.mobile_banking_enabled IS
  'Offer Omise Mobile Banking (open bank app) in LIFF. Needs omise_secret_key; each bank must also be activated on the Omise account.';

COMMENT ON COLUMN public.bookings.payment_method IS
  'null | omise_promptpay | omise_mobile_banking | bank_transfer | bank_deeplink';
COMMENT ON COLUMN public.bookings.bank_provider IS
  'kbank | scb | bay | bbl | ktb — bank app used by bank_deeplink (scb/kbank only) or omise_mobile_banking';
COMMENT ON COLUMN public.bookings.bank_deeplink_url IS
  'Link that opens the bank app: bank deeplink (bank_deeplink) or Omise authorize_uri (omise_mobile_banking)';
