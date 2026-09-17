-- Demo-sandbox flag for the two payment tables.
--
-- payment_slips and payment_transactions were created after the demo sandbox
-- (202605150001_demo_sandbox_phase1.sql), so they never got the is_demo column
-- the sandbox uses to find and clear its own rows. Without it, a demo slip
-- would sit in the shop's verification queue forever and "reset demo data"
-- could not remove it.

ALTER TABLE public.payment_slips
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.payment_slips.is_demo IS
  'Row belongs to the demo sandbox. Cleared by resetDemoSandbox / archived by convertDemoToReal.';
COMMENT ON COLUMN public.payment_transactions.is_demo IS
  'Row belongs to the demo sandbox. No real money moved.';
