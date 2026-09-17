import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import {
  archiveNotification,
  createNotification,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/lib/notifications/createNotification';
import type { NotificationCategory, NotificationPriority } from '@/types/notification';

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function getErrorPayload(e: unknown) {
  if (e && typeof e === 'object') {
    const obj = e as { message?: string; code?: string; details?: string; hint?: string };
    return {
      error: obj.message ?? 'Unexpected error',
      code: obj.code ?? null,
      details: obj.details ?? null,
      hint: obj.hint ?? null,
    };
  }
  return { error: e instanceof Error ? e.message : 'Unexpected error', code: null, details: null, hint: null };
}

const createSchema = z.object({
  title: z.string().min(1),
  message: z.string().optional(),
  body: z.string().optional(),
  type: z.string().optional(),
  category: z.enum(['bookings', 'operations', 'customers', 'billing', 'system', 'marketing']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  related_type: z.string().optional(),
  related_id: z.string().uuid().optional(),
  action_url: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  dev_test: z.boolean().optional(),
});

const patchSchema = z.object({
  action: z.enum(['mark_read', 'mark_all_read', 'archive']).optional(),
  id: z.string().uuid().optional(),
});

export async function GET(req: Request) {
  try {
    const { supabase, user, profile, branchScope } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unread_only') === 'true';
    const category = (searchParams.get('category') ?? '') as NotificationCategory | '';
    const priority = (searchParams.get('priority') ?? '') as NotificationPriority | '';
    const q = searchParams.get('q') ?? '';
    const limit = Math.max(1, Math.min(toInt(searchParams.get('limit'), 50), 100));
    const offset = Math.max(0, Number(searchParams.get('offset') ?? 0) || 0);
    const includeArchived = searchParams.get('include_archived') === 'true';

    const { data, total } = await getNotifications(supabase, {
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      unreadOnly,
      category,
      priority,
      search: q,
      limit,
      offset,
      includeArchived,
      branchScope,
    });

    const unread_count = await getUnreadNotificationCount(supabase, {
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      branchScope,
    });

    return NextResponse.json({ data, pagination: { total, limit, offset }, unread_count });
  } catch (e) {
    return NextResponse.json(getErrorPayload(e), { status: getErrorStatus(e) });
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const raw = await req.json();
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });

    if (parsed.data.dev_test && process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'dev_test is available only in development' }, { status: 403 });
    }

    const message = parsed.data.message?.trim() || parsed.data.body?.trim() || '';
    const data = await createNotification(supabase, {
      companyId: profile.company_id,
      shopId: profile.shop_id,
      userId: user.id,
      type: parsed.data.type ?? 'system_info',
      category: parsed.data.category ?? 'system',
      priority: parsed.data.priority ?? 'medium',
      title: parsed.data.title,
      message,
      relatedType: parsed.data.related_type,
      relatedId: parsed.data.related_id,
      actionUrl: parsed.data.action_url,
      icon: parsed.data.icon,
      color: parsed.data.color,
      metadata: parsed.data.metadata,
      createdBy: user.id,
    });

    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json(getErrorPayload(e), { status: getErrorStatus(e) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { supabase, user, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager', 'staff'] });
    const raw = await req.json();
    const parsed = patchSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });

    const action = parsed.data.action ?? 'mark_read';

    if (action === 'mark_all_read') {
      await markAllNotificationsAsRead(supabase, {
        companyId: profile.company_id,
        shopId: profile.shop_id,
        userId: user.id,
      }, user.id);
      return NextResponse.json({ data: true });
    }

    if (!parsed.data.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    if (action === 'archive') {
      await archiveNotification(supabase, parsed.data.id, user.id);
      return NextResponse.json({ data: true });
    }

    await markNotificationAsRead(supabase, parsed.data.id, user.id);
    return NextResponse.json({ data: true });
  } catch (e) {
    return NextResponse.json(getErrorPayload(e), { status: getErrorStatus(e) });
  }
}
