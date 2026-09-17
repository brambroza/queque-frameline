import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopByKeyOrId } from '@/lib/line/shop-resolver';

const schema = z.object({
  line_user_id: z.string().min(1),
  display_name: z.string().optional(),
  picture_url: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const admin = createAdminClient();
  const shop = await resolveShopByKeyOrId(admin, shopKey);

  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  const payload = parsed.data;

  const { data: lineUser, error: lineUserError } = await admin
    .from('line_users')
    .upsert(
      {
        company_id: shop.company_id,
        shop_id: shop.id,
        line_user_id: payload.line_user_id,
        display_name: payload.display_name ?? null,
        picture_url: payload.picture_url ?? null,
      },
      { onConflict: 'shop_id,line_user_id' },
    )
    .select('id,line_user_id,display_name')
    .single();

  if (lineUserError || !lineUser) {
    return NextResponse.json({ error: lineUserError?.message ?? 'line user upsert failed' }, { status: 400 });
  }

  const { data: existingCustomers, error: customerFindError } = await admin
    .from('customers')
    .select('id,full_name,nickname,phone,line_user_id')
    .eq('shop_id', shop.id)
    .eq('line_user_id', lineUser.id)
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false })
    .limit(5);

  if (customerFindError) {
    return NextResponse.json({ error: customerFindError.message }, { status: 400 });
  }

  const existingCustomer = (existingCustomers ?? [])[0] ?? null;
  if (existingCustomer) {
    return NextResponse.json({
      data: {
        is_member: true,
        was_registered: false,
        customer: existingCustomer,
      },
    });
  }

  const { data: newCustomer, error: createCustomerError } = await admin
    .from('customers')
    .insert({
      company_id: shop.company_id,
      shop_id: shop.id,
      line_user_id: lineUser.id,
      full_name: payload.display_name ?? 'LINE Customer',
      phone: null,
    })
    .select('id,full_name,nickname,phone,line_user_id')
    .single();

  if (createCustomerError || !newCustomer) {
    return NextResponse.json({ error: createCustomerError?.message ?? 'customer create failed' }, { status: 400 });
  }

  return NextResponse.json({
    data: {
      is_member: true,
      was_registered: true,
      customer: newCustomer,
    },
  });
}
