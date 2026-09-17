import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { normalizePromptPayTarget } from '@/lib/payments/promptpay';

const patchSchema = z.object({
  qr_payment_enabled: z.boolean().optional(),
  mobile_banking_enabled: z.boolean().optional(),
  omise_public_key: z.string().optional(),
  omise_secret_key: z.string().optional(),
  transfer_payment_enabled: z.boolean().optional(),
  promptpay_id: z.string().optional(),
  promptpay_display_name: z.string().optional(),
  bank_name: z.string().optional(),
  bank_account_no: z.string().optional(),
  bank_account_name: z.string().optional(),
  transfer_payment_window_minutes: z.number().int().min(15).max(20160).optional(),
});

export async function GET(_req: Request) {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner'] });

    const { data, error } = await supabase
      .from('shops')
      .select(
        'qr_payment_enabled, mobile_banking_enabled, omise_public_key, omise_secret_key, transfer_payment_enabled, promptpay_id, promptpay_display_name, bank_name, bank_account_no, bank_account_name, transfer_payment_window_minutes',
      )
      .eq('id', profile.shop_id)
      .maybeSingle();

    if (error) throw error;

    // Mask secret key in response — show only last 4 chars
    const masked = data?.omise_secret_key
      ? `skey_...${data.omise_secret_key.slice(-4)}`
      : null;

    return NextResponse.json({
      data: {
        qr_payment_enabled: data?.qr_payment_enabled ?? false,
        mobile_banking_enabled: data?.mobile_banking_enabled ?? false,
        // Mobile banking's return page is secured by this secret; without it the method stays hidden.
        mobile_banking_available: Boolean(process.env.PAYMENT_LINK_SECRET),
        omise_public_key: data?.omise_public_key ?? null,
        omise_secret_key_set: !!data?.omise_secret_key,
        omise_secret_key_hint: masked,
        transfer_payment_enabled: data?.transfer_payment_enabled ?? false,
        // The shop owner configured this id, so they may see it in full — it is
        // only customers who get the masked form.
        promptpay_id: data?.promptpay_id ?? null,
        promptpay_display_name: data?.promptpay_display_name ?? null,
        bank_name: data?.bank_name ?? null,
        bank_account_no: data?.bank_account_no ?? null,
        bank_account_name: data?.bank_account_name ?? null,
        transfer_payment_window_minutes: data?.transfer_payment_window_minutes ?? 1440,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner'] });
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const updates: Record<string, unknown> = { updated_by: user.id };
    const d = parsed.data;

    if (d.qr_payment_enabled !== undefined) updates.qr_payment_enabled = d.qr_payment_enabled;
    if (d.mobile_banking_enabled !== undefined) updates.mobile_banking_enabled = d.mobile_banking_enabled;
    if (d.omise_public_key !== undefined) updates.omise_public_key = d.omise_public_key || null;
    // Only update secret key if a full key is provided (not the masked hint)
    if (d.omise_secret_key && !d.omise_secret_key.includes('...')) {
      updates.omise_secret_key = d.omise_secret_key;
    }

    if (d.transfer_payment_enabled !== undefined) updates.transfer_payment_enabled = d.transfer_payment_enabled;
    if (d.promptpay_display_name !== undefined) updates.promptpay_display_name = d.promptpay_display_name || null;
    if (d.bank_name !== undefined) updates.bank_name = d.bank_name || null;
    if (d.bank_account_no !== undefined) updates.bank_account_no = d.bank_account_no || null;
    if (d.bank_account_name !== undefined) updates.bank_account_name = d.bank_account_name || null;
    if (d.transfer_payment_window_minutes !== undefined) {
      updates.transfer_payment_window_minutes = d.transfer_payment_window_minutes;
    }

    // Store the PromptPay id normalized, and reject anything unparseable — an
    // invalid target would produce a QR no bank app can pay.
    if (d.promptpay_id !== undefined) {
      if (!d.promptpay_id) {
        updates.promptpay_id = null;
      } else {
        const target = normalizePromptPayTarget(d.promptpay_id);
        if (!target) {
          return NextResponse.json(
            { error: 'PromptPay ID ไม่ถูกต้อง — ใช้เบอร์มือถือ 10 หลัก หรือเลขบัตรประชาชน/เลขผู้เสียภาษี 13 หลัก' },
            { status: 400 },
          );
        }
        updates.promptpay_id = target.value;
      }
    }

    // Guard the combination that silently produces unpayable bookings.
    if (d.transfer_payment_enabled === true) {
      const promptpayAfter =
        updates.promptpay_id !== undefined
          ? (updates.promptpay_id as string | null)
          : (
              await supabase.from('shops').select('promptpay_id').eq('id', profile.shop_id).maybeSingle()
            ).data?.promptpay_id ?? null;
      if (!promptpayAfter) {
        return NextResponse.json(
          { error: 'ต้องกรอก PromptPay ID ก่อนเปิดรับชำระด้วยการโอน' },
          { status: 400 },
        );
      }
    }

    // Both Omise methods need a secret key; enabling either without one would
    // leave customers with a booking that has no way to pay.
    if (d.qr_payment_enabled === true || d.mobile_banking_enabled === true) {
      const keyAfter =
        updates.omise_secret_key !== undefined
          ? (updates.omise_secret_key as string)
          : (
              await supabase.from('shops').select('omise_secret_key').eq('id', profile.shop_id).maybeSingle()
            ).data?.omise_secret_key ?? process.env.OMISE_SECRET_KEY ?? null;
      if (!keyAfter) {
        return NextResponse.json(
          { error: 'ต้องกรอก Omise Secret Key ก่อนเปิดรับชำระผ่าน Omise' },
          { status: 400 },
        );
      }
    }

    const { error } = await supabase
      .from('shops')
      .update(updates)
      .eq('id', profile.shop_id);

    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
