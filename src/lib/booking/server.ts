/**
 * Server-side helpers shared by the portal, public-token and cron routes.
 * Everything takes the Supabase client to use, so the caller decides between
 * the session client (RLS) and the service-role client.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { PAYMENT_BLOCK_MESSAGE } from '@/lib/booking/payment';
import type { AppRole, AutoCallMode } from '@/types/db';
import type { TransitionActor } from '@/lib/booking/status-flow';

export type SiteSettings = {
  grace_minutes: number;
  early_arrival_minutes: number;
  auto_call_mode: AutoCallMode;
  auto_call_lead_minutes: number;
  called_timeout_minutes: number;
  auto_no_show_after_grace: boolean;
  booking_token_ttl_days: number;
  driver_token_ttl_days: number;
  booking_lead_min_hours: number;
  booking_horizon_days: number;
  require_admin_confirm: boolean;
  driver_self_checkin: boolean;
  do_number_format: string;
  item_minutes_enabled: boolean;
  minutes_per_item: number;
  /** Tell a checked-in driver "dock delayed, please wait" once the appointment time has passed. */
  wait_notice_enabled: boolean;
  /** Minutes after the appointment start before that notice goes out (0 = at start). */
  wait_notice_minutes: number;
  auto_call_last_run_at: string | null;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  grace_minutes: 30,
  early_arrival_minutes: 60,
  auto_call_mode: 'dock_free',
  auto_call_lead_minutes: 0,
  called_timeout_minutes: 15,
  auto_no_show_after_grace: true,
  booking_token_ttl_days: 7,
  driver_token_ttl_days: 3,
  booking_lead_min_hours: 2,
  booking_horizon_days: 30,
  require_admin_confirm: true,
  driver_self_checkin: false,
  do_number_format: 'DO-{YYYYMM}-{NNNN}',
  item_minutes_enabled: true,
  minutes_per_item: 10,
  wait_notice_enabled: true,
  wait_notice_minutes: 5,
  auto_call_last_run_at: null,
};

export const SITE_SETTINGS_COLUMNS = Object.keys(DEFAULT_SITE_SETTINGS).join(',');

/** Site settings row, falling back to defaults when the row is missing. */
export async function getSiteSettings(client: SupabaseClient, shopId: string): Promise<SiteSettings> {
  const { data } = await client.from('site_settings').select(SITE_SETTINGS_COLUMNS).eq('shop_id', shopId).maybeSingle();
  return { ...DEFAULT_SITE_SETTINGS, ...((data as Partial<SiteSettings> | null) ?? {}) };
}

/** Portal role → transition actor. Admin wins when a user holds both. */
export function actorFromRoles(roles: AppRole[]): Extract<TransitionActor, 'admin' | 'staff'> {
  return roles.includes('admin') ? 'admin' : 'staff';
}

export type BookingLogInput = {
  companyId: string;
  shopId: string;
  bookingId: string;
  /** status_change | create | plate_change | reschedule | do_issued | driver_link | cancel */
  action: string;
  description: string;
  from?: unknown;
  to?: unknown;
  actorKind: TransitionActor | 'driver';
  actorId?: string | null;
};

/**
 * Append to the booking audit log (`booking_logs`). Never throws: an audit
 * failure must not undo a gate action, but it is reported to the server log.
 */
export async function logBooking(client: SupabaseClient, input: BookingLogInput): Promise<void> {
  try {
    const { error } = await client.from('booking_logs').insert({
      company_id: input.companyId,
      shop_id: input.shopId,
      booking_id: input.bookingId,
      action: input.action,
      description: input.description,
      from_value: input.from ?? null,
      to_value: input.to ?? null,
      actor_kind: input.actorKind,
      created_by: input.actorId ?? null,
      updated_by: input.actorId ?? null,
    });
    if (error) console.error('[booking-log] insert failed:', error.message);
  } catch (e) {
    console.error('[booking-log] insert failed:', e instanceof Error ? e.message : e);
  }
}

/** Errors raised by the dock SQL functions, mapped to HTTP + Thai copy. */
export function dockErrorResponse(message: string | undefined | null): { status: number; error: string; code: string } | null {
  const m = String(message ?? '');
  if (m.includes('payment_required')) return { status: 409, code: 'payment_required', error: PAYMENT_BLOCK_MESSAGE };
  if (m.includes('duration_conflict')) return { status: 409, code: 'duration_conflict', error: 'เวลาที่ท่านานขนาดนี้ชนกับคิวถัดไปของท่าเดียวกัน (หรือข้ามวัน) — ลดเวลาลง หรือเลื่อนคิวก่อน' };
  if (m.includes('dock_conflict')) return { status: 409, code: 'dock_conflict', error: 'ท่านี้มีคิวอื่นในช่วงเวลาเดียวกันแล้ว — เลื่อนคิวหรือปรับเวลาที่ท่าก่อน' };
  if (m.includes('invalid_minutes')) return { status: 400, code: 'invalid_minutes', error: 'เวลาที่ท่าต้องอยู่ระหว่าง 5–1440 นาที' };
  if (m.includes('not_adjustable')) return { status: 409, code: 'not_adjustable', error: 'คิวนี้ปิดแล้ว ปรับเวลาไม่ได้' };
  if (m.includes('slot_unavailable')) return { status: 409, code: 'slot_unavailable', error: 'ช่วงเวลานี้เต็มแล้ว กรุณาเลือกเวลาใหม่' };
  if (m.includes('invalid_service')) return { status: 400, code: 'invalid_service', error: 'ประเภทรถไม่ถูกต้องสำหรับคิวประเภทนี้' };
  if (m.includes('not_movable')) return { status: 409, code: 'not_movable', error: 'คิวนี้เลื่อนไม่ได้แล้ว' };
  if (m.includes('invalid_shop') || m.includes('invalid_status')) return { status: 400, code: 'invalid_request', error: 'คำขอไม่ถูกต้อง' };
  return null;
}

/** The branch to use when the caller did not send one: the site's first active branch. */
export async function resolveDefaultBranchId(client: SupabaseClient, shopId: string): Promise<string | null> {
  const { data } = await client
    .from('branches')
    .select('id')
    .eq('shop_id', shopId)
    .eq('is_deleted', false)
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
