import { NextResponse } from 'next/server';
import { SubscriptionInactiveError, SubscriptionQuotaError } from '@/lib/subscription/enforcement';

/**
 * Converts a subscription error into a structured response the client can use
 * to render an upgrade prompt. Returns null for anything else so callers can
 * fall through to their normal error handling.
 *
 * @param e - The value caught in a route handler's catch block.
 */
export function subscriptionErrorResponse(e: unknown): NextResponse | null {
  if (e instanceof SubscriptionQuotaError) {
    return NextResponse.json({ error: e.message, subscription: e.toJSON() }, { status: e.status });
  }
  if (e instanceof SubscriptionInactiveError) {
    return NextResponse.json(
      { error: e.message, subscription: { kind: e.kind, message: e.message } },
      { status: e.status }
    );
  }
  return null;
}
