import { redirect } from 'next/navigation';

/** Single-site app: the root has no landing page, go straight to the portal (login guard redirects if needed). */
export default function RootPage() {
  redirect('/portal');
}
