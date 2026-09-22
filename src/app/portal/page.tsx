import { redirect } from 'next/navigation';
import { getPageRoles } from '@/lib/auth/page-roles';
import { firstAllowedHref } from '@/lib/auth/menu-registry';

/** Land on the first menu the user may open. */
export default async function PortalPage() {
  const { access } = await getPageRoles();
  redirect(firstAllowedHref(access));
}
