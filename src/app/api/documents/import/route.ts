import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { documentPortalPath } from '@/lib/auth/document-access';
import { CSV_MAX_ROWS, parseDocumentsCsv } from '@/lib/integration/csv';
import { upsertDocument } from '@/lib/integration/upsert';
import { safeCreateNotification } from '@/lib/notifications/createNotification';

const MAX_BYTES = 2 * 1024 * 1024;

const bodySchema = z.object({
  doc_type: z.enum(['so', 'po']),
  csv: z.string().min(1).max(MAX_BYTES),
  /** true = validate and report only; nothing is written. */
  dry_run: z.boolean().default(false),
  /** Branch for rows that carry no branch column. */
  branch_id: z.string().uuid().optional().nullable(),
});

/** CSV import of SO / PO. Always call with `dry_run` first so the admin sees what will happen. */
export async function POST(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['admin'] });
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'ไฟล์ไม่ถูกต้อง หรือใหญ่เกิน 2 MB' }, { status: 400 });
    const { doc_type: docType, csv, dry_run: dryRun, branch_id: branchId } = parsed.data;

    const result = parseDocumentsCsv(csv);
    if (result.missingColumns.length > 0) {
      return NextResponse.json({ error: `ไม่พบคอลัมน์ที่จำเป็น: ${result.missingColumns.join(', ')}`, code: 'missing_columns', missing: result.missingColumns }, { status: 400 });
    }

    const summary = {
      rows: result.rowCount,
      truncated: result.rowCount >= CSV_MAX_ROWS,
      documents: result.documents.length,
      errors: result.errors,
      preview: result.documents.slice(0, 50).map((d) => ({ doc_no: d.doc_no, partner: d.partner.name, items: d.items.length, due_date: d.due_date ?? null, branch: d.branch ?? null })),
    };
    if (dryRun) return NextResponse.json({ data: { ...summary, created: 0, updated: 0, failed: [] } });

    const site = { shopId: profile.shop_id, companyId: profile.company_id };
    let created = 0;
    let updated = 0;
    const failed: Array<{ doc_no: string; message: string }> = [];
    for (const doc of result.documents) {
      const outcome = await upsertDocument(supabase, site, docType, 'csv', doc, user.id, { branchId: doc.branch ? null : branchId ?? null });
      if (!outcome.ok) failed.push({ doc_no: outcome.doc_no, message: outcome.message });
      else if (outcome.created) created += 1;
      else updated += 1;
    }

    await safeCreateNotification(supabase, {
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      type: 'document_imported',
      category: 'system',
      priority: 'low',
      title: `นำเข้า ${docType.toUpperCase()} ${created + updated} รายการ`,
      message: `ใหม่ ${created} · อัปเดต ${updated} · ไม่สำเร็จ ${failed.length + result.errors.length}`,
      actionUrl: documentPortalPath(docType),
      icon: 'UploadFile',
      color: '#1565c0',
      metadata: { doc_type: docType, created, updated, failed: failed.length },
      createdBy: user.id,
    });

    return NextResponse.json({ data: { ...summary, created, updated, failed } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
