import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { paymentSecretBox } from '@/lib/crypto/secret-box';
import { BANK_PROVIDERS, type BankProvider } from '@/types/db';
import { getDeeplinkAdapter, listProviders } from '@/lib/payments/deeplink/registry';
import { buildDeeplinkWebhookUrl } from '@/lib/payments/deeplink/settings';

/**
 * Per-shop bank deeplink settings.
 *
 * Reads and writes go through the service-role client on purpose: the table
 * holds encrypted bank credentials and therefore has RLS enabled with no
 * policies. Authorization happens here (owner roles) and every query is scoped
 * by profile.shop_id, so this is the documented exception to "no admin client".
 */

const ROLES = ['super_admin', 'shop_owner'] as const;

const patchSchema = z.object({
  provider: z.enum(BANK_PROVIDERS),
  enabled: z.boolean().optional(),
  environment: z.enum(['sandbox', 'production']).optional(),
  biller_id: z.string().trim().max(40).optional(),
  merchant_name: z.string().trim().max(80).optional(),
  session_minutes: z.number().int().min(5).max(60).optional(),
  /** Adapter-specific credential fields; validated by the adapter, sealed before storage. */
  credentials: z.record(z.string(), z.string()).optional(),
});

// VERIFY: SCB Biller ID is 15 digits; KBank merchant id format unknown.
const BILLER_PATTERN: Record<BankProvider, RegExp> = {
  scb: /^\d{15}$/,
  kbank: /^[A-Za-z0-9-]{4,40}$/,
};

interface ProviderRow {
  id: string;
  provider: string;
  enabled: boolean;
  environment: string;
  biller_id: string | null;
  merchant_name: string | null;
  credentials_enc: string | null;
  credentials_hint: string | null;
  webhook_secret: string;
  session_minutes: number;
}

async function loadRows(shopId: string): Promise<ProviderRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('shop_bank_deeplink_providers')
    .select('id, provider, enabled, environment, biller_id, merchant_name, credentials_enc, credentials_hint, webhook_secret, session_minutes')
    .eq('shop_id', shopId)
    .eq('is_deleted', false);
  if (error) throw error;
  return (data ?? []) as ProviderRow[];
}

function present(row: ProviderRow | undefined, provider: BankProvider, shopKey: string, displayName: string, available: boolean) {
  return {
    provider,
    display_name: displayName,
    available,
    enabled: row?.enabled ?? false,
    environment: row?.environment ?? 'sandbox',
    biller_id: row?.biller_id ?? '',
    merchant_name: row?.merchant_name ?? '',
    session_minutes: row?.session_minutes ?? 15,
    credentials_set: Boolean(row?.credentials_enc),
    credentials_hint: row?.credentials_hint ?? null,
    // Carries the per-shop secret — only ever shown to the owner, who pastes it into the bank portal.
    webhook_url: row ? buildDeeplinkWebhookUrl(provider, shopKey, row.webhook_secret) : null,
  };
}

export async function GET() {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: [...ROLES] });
    const { data: shop } = await supabase.from('shops').select('shop_key').eq('id', profile.shop_id).maybeSingle();
    const shopKey = (shop?.shop_key as string | undefined) ?? '';
    const rows = await loadRows(profile.shop_id);

    return NextResponse.json({
      data: {
        link_secret_configured: Boolean(process.env.PAYMENT_LINK_SECRET),
        providers: listProviders().map(({ provider, displayName, available }) =>
          present(rows.find((r) => r.provider === provider), provider, shopKey, displayName, available),
        ),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, profile } = await requireAuthContext({ roles: [...ROLES] });
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    const d = parsed.data;
    const adapter = getDeeplinkAdapter(d.provider);

    const rows = await loadRows(profile.shop_id);
    const existing = rows.find((r) => r.provider === d.provider);

    const updates: Record<string, unknown> = { updated_by: user.id, updated_at: new Date().toISOString() };
    if (d.enabled !== undefined) updates.enabled = d.enabled;
    if (d.environment !== undefined) updates.environment = d.environment;
    if (d.merchant_name !== undefined) updates.merchant_name = d.merchant_name || null;
    if (d.session_minutes !== undefined) updates.session_minutes = d.session_minutes;

    if (d.biller_id !== undefined) {
      if (d.biller_id && !BILLER_PATTERN[d.provider].test(d.biller_id)) {
        return NextResponse.json(
          { error: d.provider === 'scb' ? 'Biller ID ของ SCB ต้องเป็นตัวเลข 15 หลัก' : 'Merchant ID ไม่ถูกต้อง' },
          { status: 400 },
        );
      }
      updates.biller_id = d.biller_id || null;
    }

    // Credentials are replaced only when a complete set arrives — a form that
    // re-submits blank password fields must not wipe the stored ones.
    if (d.credentials && Object.values(d.credentials).some((v) => v.trim())) {
      let credentials: unknown;
      try {
        credentials = adapter.parseCredentials(d.credentials);
      } catch {
        return NextResponse.json({ error: 'ข้อมูล API credentials ไม่ครบหรือไม่ถูกต้อง' }, { status: 400 });
      }
      const box = paymentSecretBox();
      if (!box.configured) return NextResponse.json({ error: 'ระบบยังไม่ได้ตั้งค่า key สำหรับเข้ารหัส credentials' }, { status: 500 });
      updates.credentials_enc = box.seal(JSON.stringify(credentials));
      updates.credentials_hint = adapter.credentialsHint(credentials);
    }

    // Guard the combination that silently produces unpayable bookings.
    const enabledAfter = d.enabled ?? existing?.enabled ?? false;
    if (enabledAfter) {
      const billerAfter = (updates.biller_id as string | null | undefined) ?? existing?.biller_id ?? null;
      const credsAfter = (updates.credentials_enc as string | undefined) ?? existing?.credentials_enc ?? null;
      if (!billerAfter || !credsAfter) {
        return NextResponse.json({ error: 'ต้องกรอก Biller/Merchant ID และ API credentials ก่อนเปิดใช้งาน' }, { status: 400 });
      }
      if (!process.env.PAYMENT_LINK_SECRET) {
        return NextResponse.json({ error: 'ระบบยังไม่ได้ตั้งค่า PAYMENT_LINK_SECRET — เปิดใช้งานไม่ได้' }, { status: 400 });
      }
    }

    const admin = createAdminClient();
    if (existing) {
      const { error } = await admin
        .from('shop_bank_deeplink_providers')
        .update(updates)
        .eq('id', existing.id)
        .eq('shop_id', profile.shop_id);
      if (error) throw error;
    } else {
      const { error } = await admin.from('shop_bank_deeplink_providers').insert({
        company_id: profile.company_id,
        shop_id: profile.shop_id,
        provider: d.provider,
        enabled: false,
        environment: 'sandbox',
        session_minutes: 15,
        webhook_secret: randomBytes(24).toString('hex'),
        created_by: user.id,
        ...updates,
      });
      if (error) throw error;
    }

    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
