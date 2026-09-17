import type { SupabaseClient } from '@supabase/supabase-js';

type SeedInput = {
  companyId: string;
  shopId: string;
  userId: string;
  /** Matches service_templates.business_category. Optional — a generic service is used when absent. */
  businessCategory?: string | null;
};

const DEFAULT_OPEN = '09:00';
const DEFAULT_CLOSE = '18:00';
const DEFAULT_BRANCH_NAME = 'สาขาหลัก';
const DEFAULT_SLOT_MINUTES = 30;
const MAX_SEEDED_SERVICES = 3;

type TemplateRow = {
  service_name: string;
  booking_mode: string;
  duration_minutes: number | null;
  min_duration_minutes: number | null;
  max_duration_minutes: number | null;
  capacity_per_slot: number | null;
  requires_approval: boolean;
  allow_walk_in: boolean;
};

/**
 * Gives a brand-new shop the minimum data it needs to accept a booking:
 * a branch, at least one service, and working hours for all seven weekdays.
 *
 * Working hours are the part that matters most — `get_available_slots` returns
 * nothing without a row for the requested weekday, so a shop without them looks
 * permanently closed to its own customers no matter what else is configured.
 *
 * Best-effort: a seeding failure is logged but never fails the registration
 * that triggered it, since the owner can still create these records by hand.
 *
 * @param admin - Service-role client (runs before the owner has a session).
 * @param input - Tenant identifiers plus the optional business category.
 * @returns Whether the shop ended up bookable.
 */
export async function seedNewShop(admin: SupabaseClient, input: SeedInput): Promise<boolean> {
  const { companyId, shopId, userId, businessCategory } = input;
  const audit = { created_by: userId, updated_by: userId };

  try {
    const { data: branch, error: branchError } = await admin
      .from('branches')
      .insert({
        company_id: companyId,
        shop_id: shopId,
        branch_name: DEFAULT_BRANCH_NAME,
        open_time: DEFAULT_OPEN,
        close_time: DEFAULT_CLOSE,
        max_parallel_queues: 1,
        active: true,
        ...audit,
      })
      .select('id')
      .single();

    if (branchError || !branch) {
      console.warn('[seed-new-shop] branch insert failed:', branchError?.message);
      return false;
    }

    // Open every weekday by default. An owner who is closed on Sundays edits one
    // row; an owner with no rows at all has a shop nobody can book and no hint why.
    const workingHours = Array.from({ length: 7 }, (_, weekday) => ({
      company_id: companyId,
      shop_id: shopId,
      branch_id: branch.id,
      weekday,
      open_time: DEFAULT_OPEN,
      close_time: DEFAULT_CLOSE,
      slot_interval_minutes: DEFAULT_SLOT_MINUTES,
      capacity_per_slot: 1,
      active: true,
      ...audit,
    }));

    const { error: hoursError } = await admin.from('working_hours').insert(workingHours);
    if (hoursError) {
      console.warn('[seed-new-shop] working hours insert failed:', hoursError.message);
      return false;
    }

    let templates: TemplateRow[] = [];
    if (businessCategory) {
      const { data } = await admin
        .from('service_templates')
        .select('service_name,booking_mode,duration_minutes,min_duration_minutes,max_duration_minutes,capacity_per_slot,requires_approval,allow_walk_in')
        .eq('business_category', businessCategory)
        .eq('active', true)
        .order('sort_order', { ascending: true })
        .limit(MAX_SEEDED_SERVICES);
      templates = (data ?? []) as TemplateRow[];
    }

    const services =
      templates.length > 0
        ? templates.map((t) => ({
            company_id: companyId,
            shop_id: shopId,
            service_name: t.service_name,
            booking_mode: t.booking_mode,
            duration_minutes: t.duration_minutes ?? DEFAULT_SLOT_MINUTES,
            min_duration_minutes: t.min_duration_minutes,
            max_duration_minutes: t.max_duration_minutes,
            capacity_per_slot: t.capacity_per_slot ?? 1,
            requires_approval: t.requires_approval,
            allow_walk_in: t.allow_walk_in,
            price: 0,
            active: true,
            ...audit,
          }))
        : [
            {
              company_id: companyId,
              shop_id: shopId,
              service_name: 'บริการทั่วไป',
              booking_mode: 'fixed_slot',
              duration_minutes: DEFAULT_SLOT_MINUTES,
              capacity_per_slot: 1,
              requires_approval: false,
              allow_walk_in: false,
              price: 0,
              active: true,
              ...audit,
            },
          ];

    const { error: serviceError } = await admin.from('services').insert(services);
    if (serviceError) {
      console.warn('[seed-new-shop] services insert failed:', serviceError.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('[seed-new-shop] unexpected failure:', err);
    return false;
  }
}
