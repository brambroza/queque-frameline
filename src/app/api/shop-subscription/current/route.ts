import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSubscriptionState } from '@/lib/subscription/enforcement';
import { countShopUsage } from '@/lib/subscription/usage';

export async function GET() {
  try {
    const { profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    if (!profile.shop_id) return NextResponse.json({ data: null });

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('shop_subscriptions')
      .select('shop_id,plan_code,expires_at,is_active,note,max_branches_override,max_services_override,max_staff_override,max_resources_override,max_monthly_bookings_override,subscription_plans(code,name,max_branches,max_services,max_staff,max_resources,max_monthly_bookings,price_monthly,currency)')
      .eq('shop_id', profile.shop_id)
      .eq('is_deleted', false)
      .maybeSingle();

    if (error) throw error;

    const [state, usage] = await Promise.all([getSubscriptionState(profile.shop_id), countShopUsage(profile.shop_id)]);

    const expiresAt = data?.expires_at ? new Date(String(data.expires_at)) : null;
    const daysRemaining =
      expiresAt && !Number.isNaN(expiresAt.getTime())
        ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;

    return NextResponse.json({
      data: data ?? null,
      effective: {
        plan_code: state.planCode,
        limits: state.limits,
        active: state.active,
        // True when a paid plan lapsed and the shop is running on free limits.
        downgraded: state.downgraded,
        days_remaining: daysRemaining,
      },
      usage,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
