-- QR Payment Module (Omise PromptPay)
-- Adds payment settings to shops, payment fields to bookings, and payment_transactions table.

-- 1. Shop-level QR payment settings
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS qr_payment_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS omise_public_key text,
  ADD COLUMN IF NOT EXISTS omise_secret_key text;

-- 2. Payment fields on bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS omise_charge_id text,
  ADD COLUMN IF NOT EXISTS omise_qr_image_url text,
  ADD COLUMN IF NOT EXISTS payment_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- Index for fast webhook lookup by charge id
CREATE INDEX IF NOT EXISTS idx_bookings_omise_charge_id ON public.bookings(omise_charge_id) WHERE omise_charge_id IS NOT NULL;

-- 3. Payment transactions audit table
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  shop_id uuid NOT NULL REFERENCES public.shops(id),
  booking_id uuid NOT NULL REFERENCES public.bookings(id),
  omise_charge_id text NOT NULL,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'THB',
  status text NOT NULL,
  event_type text,
  raw_event jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_booking_id ON public.payment_transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_omise_charge_id ON public.payment_transactions(omise_charge_id);

-- RLS: payment_transactions follows the same shop scope as bookings
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payment_transactions' AND policyname = 'shop_payment_transactions'
  ) THEN
    CREATE POLICY shop_payment_transactions ON public.payment_transactions
      USING (shop_id IN (
        SELECT shop_id FROM public.users_profile WHERE id = auth.uid()
      ));
  END IF;
END$$;
