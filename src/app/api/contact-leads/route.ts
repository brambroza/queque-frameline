import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { buildDetailTable, sendSalesEmail } from '@/lib/notifications/sales-email';

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['new', 'contacted', 'won', 'lost']),
});

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  company_name: z.string().trim().max(150).optional().nullable(),
  phone: z.string().trim().min(8).max(25),
  email: z.string().trim().email().max(150),
  business_type: z.string().trim().min(2).max(120),
  message: z.string().trim().min(5).max(2000),
  website: z.string().optional().default(''),
});

/** Postgres/PostgREST codes returned when the contact_leads table has not been migrated yet. */
const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205']);

const MSG_SUBMIT_FAILED = 'ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง หรือติดต่อทีมงานทาง LINE';

/** Emails the lead to sales. Never throws; returns whether delivery succeeded. */
async function notifySales(lead: z.infer<typeof schema>, note?: string): Promise<boolean> {
  return sendSalesEmail({
    subject: `Contact Lead: ${lead.name} (${lead.company_name || lead.business_type})`,
    html: buildDetailTable('New Contact Lead', [
      ['Name', lead.name],
      ['Company', lead.company_name],
      ['Business Type', lead.business_type],
      ['Phone', lead.phone],
      ['Email', lead.email],
      ['Message', lead.message],
      ['Received At', new Date().toISOString()],
      ['Note', note],
    ]),
  });
}

/** Public endpoint: stores a website enquiry and notifies sales. */
export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'ข้อมูลที่ส่งมาไม่ถูกต้อง' }, { status: 400 });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง' }, { status: 400 });
    }
    // Honeypot filled in — bots only. Pretend success so they stop retrying.
    if (parsed.data.website) return NextResponse.json({ data: true });

    const lead = parsed.data;
    const admin = createAdminClient();
    const { error } = await admin.from('contact_leads').insert({
      name: lead.name,
      company_name: lead.company_name ?? null,
      phone: lead.phone,
      email: lead.email,
      business_type: lead.business_type,
      message: lead.message,
      source: 'website',
      status: 'new',
    });

    if (error) {
      console.error('[contact-leads] insert failed:', error.code, error.message);
      // Table not migrated yet: the visitor still deserves a working form, so
      // deliver the lead by email and only fail if that channel is down too.
      if (MISSING_TABLE_CODES.has(error.code)) {
        const emailed = await notifySales(lead, 'contact_leads table missing — run migration 202605100003');
        if (emailed) return NextResponse.json({ data: true });
        return NextResponse.json({ error: MSG_SUBMIT_FAILED }, { status: 503 });
      }
      return NextResponse.json({ error: MSG_SUBMIT_FAILED }, { status: 500 });
    }

    // A lead sitting unread in Postgres is a lost lead. Notify sales immediately;
    // failure here must not fail the submission the visitor just made.
    await notifySales(lead);

    return NextResponse.json({ data: true });
  } catch (e) {
    console.error('[contact-leads] unexpected error:', e);
    return NextResponse.json({ error: MSG_SUBMIT_FAILED }, { status: 500 });
  }
}

/** Sales inbox for website enquiries. */
export async function GET(req: Request) {
  try {
    await requireAuthContext({ roles: ['super_admin'] });

    const url = new URL(req.url);
    const status = url.searchParams.get('status');

    const admin = createAdminClient();
    let query = admin.from('contact_leads').select('*').order('created_at', { ascending: false }).limit(200);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}

/** Moves a lead through new → contacted → won/lost. */
export async function PATCH(req: Request) {
  try {
    await requireAuthContext({ roles: ['super_admin'] });
    const body = updateSchema.parse(await req.json());

    const admin = createAdminClient();
    const { error } = await admin.from('contact_leads').update({ status: body.status }).eq('id', body.id);
    if (error) throw error;
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
