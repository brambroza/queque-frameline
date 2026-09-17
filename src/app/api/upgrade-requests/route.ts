import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { createUpgradeRequest } from '@/lib/subscription/upgrade-request';

const CreateSchema = z.object({
  requested_plan_code: z.enum(['professional', 'business', 'enterprise']),
  contact_name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().min(6).max(30).optional(),
  email: z.string().trim().email().max(200).optional(),
  note: z.string().trim().max(1000).optional(),
  source: z.enum(['pricing_page', 'paywall', 'settings', 'portal']).default('portal'),
});

const UpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['new', 'contacted', 'won', 'lost']),
  note: z.string().trim().max(1000).optional(),
});

/** Shop owner asks to upgrade. Sales-led: this creates a lead, not a charge. */
export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAuthContext({ roles: ['shop_owner', 'branch_manager'] });
    const body = CreateSchema.parse(await req.json());

    if (!profile.shop_id || !profile.company_id) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลร้านของผู้ใช้' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Do not spam sales with duplicates while a request is still open.
    const { data: pending } = await admin
      .from('upgrade_requests')
      .select('id')
      .eq('shop_id', profile.shop_id)
      .eq('status', 'new')
      .limit(1)
      .maybeSingle();

    if (pending) {
      return NextResponse.json({
        data: { id: pending.id, duplicate: true },
        message: 'เราได้รับคำขอของคุณแล้ว ทีมงานจะติดต่อกลับโดยเร็ว',
      });
    }

    const [{ data: shop }, { data: sub }] = await Promise.all([
      admin.from('shops').select('name,phone,email').eq('id', profile.shop_id).maybeSingle(),
      admin.from('shop_subscriptions').select('plan_code').eq('shop_id', profile.shop_id).eq('is_deleted', false).maybeSingle(),
    ]);

    const id = await createUpgradeRequest(admin, {
      companyId: profile.company_id,
      shopId: profile.shop_id,
      requestedPlanCode: body.requested_plan_code,
      currentPlanCode: sub?.plan_code ?? null,
      contactName: body.contact_name ?? null,
      phone: body.phone ?? shop?.phone ?? null,
      email: body.email ?? shop?.email ?? user.email ?? null,
      note: body.note ?? null,
      shopName: shop?.name ?? null,
      source: body.source,
      createdBy: user.id,
    });

    if (!id) {
      return NextResponse.json({ error: 'ส่งคำขอไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' }, { status: 400 });
    }

    return NextResponse.json({
      data: { id },
      message: 'ส่งคำขออัปเกรดเรียบร้อย ทีมงานจะติดต่อกลับภายใน 1 วันทำการ',
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/** Sales inbox. */
export async function GET(req: Request) {
  try {
    await requireAuthContext({ roles: ['super_admin'] });

    const url = new URL(req.url);
    const status = url.searchParams.get('status');

    const admin = createAdminClient();
    let query = admin
      .from('upgrade_requests')
      .select('*, shops(name,shop_key)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/** Sales moves a request through new → contacted → won/lost. */
export async function PATCH(req: Request) {
  try {
    const { user } = await requireAuthContext({ roles: ['super_admin'] });
    const body = UpdateSchema.parse(await req.json());

    const admin = createAdminClient();
    const { error } = await admin
      .from('upgrade_requests')
      .update({
        status: body.status,
        note: body.note ?? undefined,
        handled_by: user.id,
        handled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id);

    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
