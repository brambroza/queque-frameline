import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { getSubscriptionState } from '@/lib/subscription/enforcement';
import { countShopUsage, getDailyBookingUsage } from '@/lib/subscription/usage';

const querySchema = z.object({ shop_id: z.string().uuid() });

/**
 * Usage vs effective entitlement for one shop, for the super-admin package
 * editor. Kept out of the list endpoint on purpose: counting every shop would
 * be five count queries per row.
 */
export async function GET(req: Request) {
  try {
    await requireAuthContext({ roles: ['super_admin'] });

    const parsed = querySchema.safeParse({ shop_id: new URL(req.url).searchParams.get('shop_id') });
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const shopId = parsed.data.shop_id;
    const [usage, state, daily] = await Promise.all([
      countShopUsage(shopId),
      getSubscriptionState(shopId),
      getDailyBookingUsage(shopId),
    ]);

    return NextResponse.json({
      data: {
        usage,
        daily,
        effective: {
          plan_code: state.planCode,
          limits: state.limits,
          active: state.active,
          downgraded: state.downgraded,
        },
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
