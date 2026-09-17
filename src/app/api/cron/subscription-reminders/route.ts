import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildDetailTable, sendSalesEmail } from '@/lib/notifications/sales-email';
import { safeCreateNotification } from '@/lib/notifications/createNotification';
import { isCronAuthorized } from '@/lib/cron/auth';

/** Days before expiry at which a shop (and sales) get a reminder. */
const REMINDER_DAYS = [14, 7, 1];

function dayBoundsFromNow(days: number): { start: string; end: string } {
  const start = new Date();
  start.setDate(start.getDate() + days);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Notifies shops whose paid plan expires in 14 / 7 / 1 days, and sends sales a
 * digest so renewals get chased before the plan lapses.
 *
 * Sales-led renewals need a human to follow up; nothing here changes a plan.
 * Expiry itself is handled at read time by the enforcement layer, which drops
 * a lapsed shop to free-tier limits rather than blocking it.
 */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const summary: Array<{ days: number; shops: number }> = [];
  const digestRows: Array<[string, string]> = [];

  for (const days of REMINDER_DAYS) {
    const { start, end } = dayBoundsFromNow(days);

    const { data, error } = await admin
      .from('shop_subscriptions')
      .select('shop_id,company_id,plan_code,expires_at,shops(name,shop_key)')
      .eq('is_deleted', false)
      .eq('is_active', true)
      .not('expires_at', 'is', null)
      .gte('expires_at', start)
      .lt('expires_at', end);

    if (error) {
      console.warn('[subscription-reminders] query failed:', error.message);
      continue;
    }

    const rows = data ?? [];
    summary.push({ days, shops: rows.length });

    for (const row of rows) {
      const shop = (row.shops as { name?: string | null; shop_key?: string | null } | null) ?? null;

      await safeCreateNotification(admin, {
        companyId: String(row.company_id),
        shopId: String(row.shop_id),
        type: 'subscription_expiring',
        category: 'system',
        priority: days <= 1 ? 'high' : 'medium',
        title: `แพ็กเกจจะหมดอายุในอีก ${days} วัน`,
        message: `แพ็กเกจ ${row.plan_code ?? '-'} จะหมดอายุวันที่ ${String(row.expires_at).slice(0, 10)} ต่ออายุเพื่อใช้สิทธิ์ต่อเนื่อง`,
        actionUrl: '/portal/settings',
        metadata: { days_remaining: days, plan_code: row.plan_code },
      });

      digestRows.push([
        `${shop?.name ?? row.shop_id} (${shop?.shop_key ?? '-'})`,
        `${row.plan_code ?? '-'} • เหลือ ${days} วัน • หมดอายุ ${String(row.expires_at).slice(0, 10)}`,
      ]);
    }
  }

  if (digestRows.length > 0) {
    await sendSalesEmail({
      subject: `Renewals due: ${digestRows.length} shop(s)`,
      html: buildDetailTable('Subscriptions expiring soon', digestRows),
    });
  }

  return NextResponse.json({ data: { summary, notified: digestRows.length } });
}
