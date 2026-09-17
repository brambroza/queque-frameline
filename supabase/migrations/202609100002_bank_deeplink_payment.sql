-- Bank deeplink payment: customer pays inside their own bank app (SCB Easy, K PLUS)
-- via a bank-issued deeplink whose amount and payee are fixed by the bank API.
-- Money settles straight into the shop's own bank account — no gateway.
--
-- Complements 202606300001_qr_payment.sql (Omise) and 202608230001_bank_transfer_payment.sql
-- (slip upload), both untouched. A shop may enable any combination of the three.

-- ── 1. Per-shop, per-bank credentials ────────────────────────────────────────
-- One row per (shop, bank). Credentials are an adapter-owned JSON blob sealed
-- with AES-256-GCM (see src/lib/crypto/secret-box.ts), so adding a bank whose
-- credential shape differs needs no schema change.
CREATE TABLE IF NOT EXISTS public.shop_bank_deeplink_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  shop_id uuid NOT NULL REFERENCES public.shops(id),
  provider text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  -- SCB: 15-digit Biller ID (billPayment.accountTo). KBank: merchant id.
  biller_id text,
  -- Shown inside the bank app as the payee name; falls back to shops.name.
  merchant_name text,
  credentials_enc text,
  -- Last 4 characters of the primary key/id, for a masked "✓ configured (…abcd)" hint.
  credentials_hint text,
  -- Random per row. The bank's notification URL carries it as ?key=… because
  -- neither SCB nor KBank signs confirmation callbacks.
  webhook_secret text NOT NULL,
  -- How long a bank payment session stays open before the deeplink lapses.
  session_minutes integer NOT NULL DEFAULT 15,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  is_demo boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  CONSTRAINT shop_bank_deeplink_providers_provider_check CHECK (provider IN ('scb', 'kbank')),
  CONSTRAINT shop_bank_deeplink_providers_environment_check CHECK (environment IN ('sandbox', 'production')),
  CONSTRAINT shop_bank_deeplink_providers_session_check CHECK (session_minutes BETWEEN 5 AND 60),
  CONSTRAINT shop_bank_deeplink_providers_unique UNIQUE (shop_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_shop_bank_deeplink_providers_shop
  ON public.shop_bank_deeplink_providers(shop_id) WHERE is_deleted = false;

COMMENT ON TABLE public.shop_bank_deeplink_providers IS
  'Per-shop bank deeplink credentials. credentials_enc is AES-256-GCM sealed JSON; never readable by app roles.';

-- RLS is enabled with NO policies on purpose. A SELECT policy cannot hide a
-- single column, and this table holds encrypted bank credentials, so every read
-- and write goes through the service-role client inside an authenticated portal
-- route that scopes by profile.shop_id (src/app/api/shop-payment-settings/deeplink).
ALTER TABLE public.shop_bank_deeplink_providers ENABLE ROW LEVEL SECURITY;

-- ── 2. Booking ↔ bank transaction linkage ────────────────────────────────────
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS bank_provider text,
  -- The bank's own transaction id, used to look the booking up on confirmation.
  ADD COLUMN IF NOT EXISTS bank_txn_id text,
  -- Our short reference sent as ref1 / partnerTxnUid. Bank reference fields are
  -- length- and charset-limited, so a uuid does not fit; this is 16 chars A-Z2-7.
  ADD COLUMN IF NOT EXISTS bank_txn_ref text,
  ADD COLUMN IF NOT EXISTS bank_deeplink_url text;

COMMENT ON COLUMN public.bookings.payment_method IS
  'null | omise_promptpay | bank_transfer | bank_deeplink';
COMMENT ON COLUMN public.bookings.bank_provider IS
  'scb | kbank — which bank issued the deeplink (payment_method = bank_deeplink only).';

CREATE INDEX IF NOT EXISTS idx_bookings_bank_txn
  ON public.bookings(shop_id, bank_txn_id) WHERE bank_txn_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_bank_txn_ref
  ON public.bookings(shop_id, bank_txn_ref) WHERE bank_txn_ref IS NOT NULL;

-- ── 3. Audit rows for non-Omise providers ────────────────────────────────────
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_txn_id text;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_txn
  ON public.payment_transactions(shop_id, provider_txn_id) WHERE provider_txn_id IS NOT NULL;
