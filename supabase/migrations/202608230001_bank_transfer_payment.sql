-- Bank transfer payment method: shop-owned PromptPay QR + customer slip upload + manual verification.
--
-- Complements the existing Omise PromptPay module (202606300001_qr_payment.sql), which stays
-- untouched. A shop may enable either method, both, or neither; when both are on the customer
-- picks at booking time.

-- ── 1. Shop-level transfer settings ──────────────────────────────────────────
-- Kept separate from qr_payment_enabled, which remains the Omise toggle.
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS transfer_payment_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promptpay_id text,
  ADD COLUMN IF NOT EXISTS promptpay_display_name text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_no text,
  ADD COLUMN IF NOT EXISTS bank_account_name text,
  ADD COLUMN IF NOT EXISTS transfer_payment_window_minutes integer NOT NULL DEFAULT 1440,
  -- LINE Login channel id, used to verify LIFF ID tokens on the payment routes.
  ADD COLUMN IF NOT EXISTS line_login_channel_id text;

COMMENT ON COLUMN public.shops.promptpay_id IS
  'Normalized PromptPay target: 10-digit phone, 13-digit national/tax id, or 15-digit e-wallet id. Never exposed to customers — only baked into the generated QR.';
COMMENT ON COLUMN public.shops.transfer_payment_window_minutes IS
  'How long a transfer invoice stays payable before payment_expires_at lapses. Default 24h.';

-- ── 2. Booking payment method + verification audit ───────────────────────────
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_verified_by uuid,
  ADD COLUMN IF NOT EXISTS payment_reject_reason text;

COMMENT ON COLUMN public.bookings.payment_method IS
  'null | omise_promptpay | bank_transfer';

-- Existing bookings with an Omise charge were, by definition, the Omise path.
UPDATE public.bookings
  SET payment_method = 'omise_promptpay'
  WHERE omise_charge_id IS NOT NULL AND payment_method IS NULL;

-- Drives the portal verification queue and the "still owes money" lookups.
CREATE INDEX IF NOT EXISTS idx_bookings_payment_review
  ON public.bookings(shop_id, payment_status)
  WHERE payment_status IN ('awaiting_verification', 'pending_payment');

-- ── 3. Uploaded transfer slips ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_slips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  shop_id uuid NOT NULL REFERENCES public.shops(id),
  booking_id uuid NOT NULL REFERENCES public.bookings(id),
  -- Object key inside the PRIVATE payment-slips bucket. Never a URL: reads mint
  -- a short-lived signed URL server-side after an authorization check.
  storage_path text NOT NULL,
  file_size integer,
  mime_type text,
  -- Customer-entered, both optional. amount_claimed is compared against
  -- bookings.payment_amount to warn staff about mismatches.
  amount_claimed numeric(12,2),
  transferred_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  reject_reason text,
  uploaded_by_line_user uuid REFERENCES public.line_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  CONSTRAINT payment_slips_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'superseded'))
);

CREATE INDEX IF NOT EXISTS idx_payment_slips_review
  ON public.payment_slips(shop_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_slips_booking
  ON public.payment_slips(booking_id, created_at DESC);

-- ── 4. Let payment_transactions record non-Omise events ──────────────────────
-- omise_charge_id was NOT NULL, which made a bank-transfer audit row impossible.
ALTER TABLE public.payment_transactions
  ALTER COLUMN omise_charge_id DROP NOT NULL;

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS method text,
  ADD COLUMN IF NOT EXISTS slip_id uuid REFERENCES public.payment_slips(id),
  ADD COLUMN IF NOT EXISTS note text;

UPDATE public.payment_transactions SET method = 'omise_promptpay' WHERE method IS NULL;

-- ── 5. RLS ───────────────────────────────────────────────────────────────────
-- Read-only to the app. Every write goes through a route handler using the
-- service-role client, so no insert/update/delete policy is created — with RLS
-- enabled and no matching policy, those are denied by default. (A deliberate
-- difference from payment_transactions, whose FOR ALL policy lets staff insert.)
ALTER TABLE public.payment_slips ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payment_slips' AND policyname = 'payment_slips_shop_read'
  ) THEN
    CREATE POLICY payment_slips_shop_read ON public.payment_slips
      FOR SELECT TO authenticated
      USING (shop_id IN (
        SELECT shop_id FROM public.users_profile WHERE id = auth.uid()
      ));
  END IF;
END$$;

-- No storage SQL here on purpose: this project creates buckets imperatively
-- (getBucket -> createBucket) and the payment-slips bucket is private, so only
-- the service role can read it — storage.objects needs no policy to stay closed.
