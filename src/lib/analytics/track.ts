'use client';

import posthog from 'posthog-js';

/**
 * Funnel events. Keeping them in one union stops the same step being logged
 * under three different names, which is what makes a funnel unreadable.
 */
export type AnalyticsEvent =
  | 'cta_clicked'
  | 'signup_started'
  | 'signup_completed'
  | 'email_verified'
  | 'onboarding_step_completed'
  | 'line_connected'
  | 'booking_created'
  | 'quota_wall_hit'
  | 'upgrade_clicked'
  | 'upgrade_requested'
  | 'contact_submitted'
  | 'sandbox_started';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
const UTM_STORAGE_KEY = 'qb-utm';

function enabled() {
  return typeof window !== 'undefined' && Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
}

/**
 * Stores the campaign parameters from the first page the visitor landed on.
 * Without this, a signup that happens three pages later has no traceable source
 * and paid-acquisition spend cannot be evaluated.
 *
 * @param search - The current query string (e.g. `window.location.search`).
 */
export function captureUtm(search: string): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(search);
  const found: Record<string, string> = {};
  UTM_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value) found[key] = value;
  });
  if (Object.keys(found).length === 0) return;

  // First touch wins: overwriting on a later visit would credit the wrong campaign.
  if (window.localStorage.getItem(UTM_STORAGE_KEY)) return;
  found.landing_path = window.location.pathname;
  found.captured_at = new Date().toISOString();
  window.localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(found));
}

/** Returns the stored first-touch campaign parameters, if any. */
export function getStoredUtm(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(UTM_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/**
 * Sends a funnel event with first-touch attribution attached.
 * Silently does nothing when PostHog is not configured or consent was declined.
 *
 * @param event - One of the known funnel events.
 * @param props - Extra properties; avoid anything that identifies an end customer.
 */
export function track(event: AnalyticsEvent, props: Record<string, unknown> = {}): void {
  if (!enabled()) return;
  try {
    posthog.capture(event, { ...getStoredUtm(), ...props });
  } catch {
    // Analytics must never break the flow it is measuring.
  }
}

/**
 * Links subsequent events to a shop account. Anonymous pageviews cannot be
 * joined to a signup, so without this the conversion rate is unknowable.
 *
 * @param userId - Supabase auth user id.
 * @param traits - Non-PII account traits (shop id, plan code, role).
 */
export function identifyUser(userId: string, traits: Record<string, unknown> = {}): void {
  if (!enabled() || !userId) return;
  try {
    posthog.identify(userId, traits);
  } catch {
    // no-op
  }
}

/** Clears identity on logout so the next session is not attributed to this user. */
export function resetIdentity(): void {
  if (!enabled()) return;
  try {
    posthog.reset();
  } catch {
    // no-op
  }
}
