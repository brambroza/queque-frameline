import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { assertBranchAllowed, assertBranchWritable } from '@/lib/auth/branch-scope';
import { writeAuditLog } from '@/lib/audit/activity-log';
import { loadSignageSettings, saveSignageSettings, SignageConfigSchema } from '@/lib/signage/settings';

const READ_ROLES = ['super_admin', 'shop_owner', 'branch_manager', 'staff'] as const;
const WRITE_ROLES = ['super_admin', 'shop_owner', 'branch_manager'] as const;

const BranchIdSchema = z.string().uuid();

const PutSchema = z
  .object({
    branch_id: BranchIdSchema.nullable(),
    config: SignageConfigSchema.partial(),
  })
  .strict();

type ShopMeta = {
  shop_key: string;
  name: string;
  logo_url: string | null;
  liff_id: string | null;
  demo_mode_enabled: boolean | null;
  demo_business_type: string | null;
};

/**
 * Read the effective signage config for the caller's shop.
 * `?branch_id=` narrows to a branch (falls back to the shop-wide row, then defaults).
 */
export async function GET(req: Request) {
  try {
    const { supabase, profile, branchScope } = await requireAuthContext({ roles: [...READ_ROLES] });
    if (!profile.shop_id) return NextResponse.json({ error: 'No shop in profile' }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const branchParam = searchParams.get('branch_id');
    const branchId = branchParam ? BranchIdSchema.safeParse(branchParam) : null;
    if (branchParam && !branchId?.success) return NextResponse.json({ error: 'Invalid branch_id' }, { status: 400 });
    const resolvedBranchId = branchId?.success ? branchId.data : null;
    if (resolvedBranchId) assertBranchAllowed(branchScope, resolvedBranchId);

    const [loaded, { data: shop, error: shopError }] = await Promise.all([
      loadSignageSettings(supabase, profile.shop_id, resolvedBranchId),
      supabase
        .from('shops')
        .select('shop_key,name,logo_url,liff_id,demo_mode_enabled,demo_business_type')
        .eq('id', profile.shop_id)
        .maybeSingle<ShopMeta>(),
    ]);
    if (shopError) throw shopError;

    return NextResponse.json({
      data: {
        config: loaded.config,
        scope: { branch_id: resolvedBranchId, source: loaded.source, settings_id: loaded.settings_id },
        shop: {
          shop_key: shop?.shop_key ?? null,
          name: shop?.name ?? '',
          logo_url: shop?.logo_url ?? null,
          liff_id: shop?.liff_id ?? null,
          demo_mode_enabled: Boolean(shop?.demo_mode_enabled),
          demo_business_type: shop?.demo_business_type ?? null,
        },
        can_edit_shop_wide: branchScope === null,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/**
 * Save signage config for one scope (a branch row, or the shop-wide row when
 * `branch_id` is null). Branch-bound callers may only write their own branches.
 */
export async function PUT(req: Request) {
  try {
    const { supabase, user, profile, branchScope } = await requireAuthContext({ roles: [...WRITE_ROLES] });
    if (!profile.shop_id || !profile.company_id) return NextResponse.json({ error: 'No shop in profile' }, { status: 400 });

    const parsed = PutSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });
    const { branch_id: branchId, config: patch } = parsed.data;

    assertBranchWritable(branchScope, branchId);

    if (branchId) {
      const { data: branch, error: branchError } = await supabase
        .from('branches')
        .select('id')
        .eq('id', branchId)
        .eq('shop_id', profile.shop_id)
        .eq('is_deleted', false)
        .maybeSingle();
      if (branchError) throw branchError;
      if (!branch) return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    const saved = await saveSignageSettings(supabase, {
      companyId: profile.company_id,
      shopId: profile.shop_id,
      branchId,
      userId: user.id,
      patch,
    });

    await writeAuditLog({
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      action: 'signage_settings_updated',
      targetTable: 'signage_settings',
      targetId: saved.settings_id,
      payload: { branch_id: branchId, changed_keys: Object.keys(patch) },
    });

    return NextResponse.json({
      data: {
        config: saved.config,
        scope: { branch_id: branchId, source: branchId ? 'branch' : 'shop', settings_id: saved.settings_id },
      },
    });
  } catch (e) {
    console.error('[signage_settings_save_failed]', e instanceof Error ? e.message : e);
    const status = getErrorStatus(e);
    return NextResponse.json(
      { error: status >= 500 ? 'บันทึกการตั้งค่าจอไม่สำเร็จ' : e instanceof Error ? e.message : 'Unexpected error' },
      { status },
    );
  }
}
