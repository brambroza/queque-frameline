import type { SupabaseClient } from '@supabase/supabase-js';
import { buildDetailTable, sendSalesEmail } from '@/lib/notifications/sales-email';

export type UpgradeRequestSource = 'register' | 'pricing_page' | 'paywall' | 'settings' | 'portal';

export type UpgradeRequestInput = {
  companyId: string | null;
  shopId: string | null;
  requestedPlanCode: string;
  currentPlanCode?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  note?: string | null;
  source: UpgradeRequestSource;
  createdBy?: string | null;
  /** Shop name, used only to make the sales email readable. */
  shopName?: string | null;
};

/**
 * Records an intent to upgrade and alerts sales. In the sales-led model this is
 * the whole "checkout": money changes hands off-platform and a super_admin then
 * activates the plan via /api/admin/shop-subscriptions.
 *
 * Never throws — losing the notification must not lose the request, and losing
 * the request must not break registration or the portal action that triggered it.
 *
 * @param admin - Service-role Supabase client (the table is service-role only).
 * @param input - Who is asking, for which plan, and from where.
 * @returns The new row id, or null when the insert failed.
 */
export async function createUpgradeRequest(
  admin: SupabaseClient,
  input: UpgradeRequestInput
): Promise<string | null> {
  let requestId: string | null = null;

  try {
    const { data, error } = await admin
      .from('upgrade_requests')
      .insert({
        company_id: input.companyId,
        shop_id: input.shopId,
        requested_plan_code: input.requestedPlanCode,
        current_plan_code: input.currentPlanCode ?? null,
        contact_name: input.contactName ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        note: input.note ?? null,
        source: input.source,
        status: 'new',
        created_by: input.createdBy ?? null,
      })
      .select('id')
      .single();

    if (error) {
      console.warn('[upgrade-request] insert failed:', error.message);
    } else {
      requestId = data?.id ?? null;
    }
  } catch (err) {
    console.warn('[upgrade-request] insert threw:', err);
  }

  try {
    await sendSalesEmail({
      subject: `Upgrade Request: ${input.shopName ?? input.contactName ?? 'Unknown shop'} → ${input.requestedPlanCode}`,
      html: buildDetailTable('Upgrade Request', [
        ['Requested Plan', input.requestedPlanCode],
        ['Current Plan', input.currentPlanCode],
        ['Shop', input.shopName],
        ['Contact', input.contactName],
        ['Phone', input.phone],
        ['Email', input.email],
        ['Source', input.source],
        ['Note', input.note],
        ['Shop ID', input.shopId],
        ['Request ID', requestId],
        ['Created At', new Date().toISOString()],
      ]),
    });
  } catch (err) {
    console.warn('[upgrade-request] sales notification failed:', err);
  }

  return requestId;
}
