import { createAdminClient } from '@/lib/supabase/admin';

type AuditInput = {
  companyId?: string | null;
  shopId?: string | null;
  userId?: string | null;
  action: string;
  targetTable?: string | null;
  targetId?: string | null;
  payload?: Record<string, unknown> | null;
};

export async function writeAuditLog(input: AuditInput) {
  try {
    const admin = createAdminClient();
    await admin.from('activity_logs').insert({
      company_id: input.companyId ?? null,
      shop_id: input.shopId ?? null,
      user_id: input.userId ?? null,
      action: input.action,
      target_table: input.targetTable ?? null,
      target_id: input.targetId ?? null,
      payload: input.payload ?? null,
      created_by: input.userId ?? null,
      updated_by: input.userId ?? null,
    });
  } catch {
    // Best-effort only: audit logging must not break primary business flow.
  }
}

