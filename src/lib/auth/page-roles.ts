import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { AppRole } from '@/types/db';

/**
 * Roles of the signed-in user, for server components that need to hide admin
 * actions. UI hint only — every API route still enforces its own roles.
 * Redirects to /login when there is no session.
 */
export async function getPageRoles(): Promise<{ roles: AppRole[]; isAdmin: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data } = await supabase.from('user_roles').select('roles(code)').eq('user_id', user.id).eq('is_deleted', false);
  const roles = (data ?? [])
    .map((r) => (r.roles as { code?: string } | null)?.code)
    .filter((c): c is AppRole => c === 'admin' || c === 'staff');
  return { roles, isAdmin: roles.includes('admin') };
}
