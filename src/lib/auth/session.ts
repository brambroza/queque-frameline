import { createClient } from '@/lib/supabase/server';

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Unauthorized');
  return data.user;
}

export async function getMyProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('users_profile')
    .select('id, company_id, shop_id, full_name, email')
    .eq('id', user.id)
    .single();

  return profile;
}
