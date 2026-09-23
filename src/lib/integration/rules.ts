/**
 * Pure decisions behind `upsertDocument`, kept out of the DB code so they can
 * be unit-tested and read as the rule book for ERP pushes.
 */
import type { DocumentSource } from '@/types/db';
import { isPaymentCleared } from '@/lib/booking/payment';

export type BranchRow = { id: string; code: string | null; branch_name: string | null };

/** Case-insensitive match on `branches.code` first, then on the branch name. */
export function resolveBranch(branches: BranchRow[], key: string): BranchRow | null {
  const k = key.trim().toLowerCase();
  if (!k) return null;
  return (
    branches.find((b) => String(b.code ?? '').toLowerCase() === k)
    ?? branches.find((b) => String(b.branch_name ?? '').toLowerCase() === k)
    ?? null
  );
}

export type PaymentWriteDecision = 'write' | 'skip_downgrade' | 'none';

/**
 * Whether an incoming SO payment status may overwrite the stored one.
 *
 * - Nothing sent → leave the stored value alone.
 * - The ERP (`api`) can never take a cleared SO back to `unpaid`: AX invoices
 *   after the goods leave, so it lags behind cash and slips the warehouse
 *   already checked. The portal keeps its own rule for that.
 * - Any other source may downgrade only while no queue has been approved,
 *   otherwise a DO would be out for goods now marked unpaid.
 */
export function decidePaymentWrite(args: {
  source: DocumentSource;
  incoming: string | undefined;
  existing: string | null | undefined;
  hasConfirmedBookings: boolean;
}): PaymentWriteDecision {
  const { source, incoming, existing, hasConfirmedBookings } = args;
  if (!incoming) return 'none';
  const downgrade = isPaymentCleared('so', existing) && !isPaymentCleared('so', incoming);
  if (!downgrade) return 'write';
  if (source === 'api') return 'skip_downgrade';
  return hasConfirmedBookings ? 'skip_downgrade' : 'write';
}

/** Statuses that mean a queue has been approved (a DO exists or will). */
export const CONFIRMED_STATUSES = ['confirmed', 'late', 'checked_in', 'called', 'serving'] as const;
