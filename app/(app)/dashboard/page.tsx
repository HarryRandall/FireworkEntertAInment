/** Legacy `/dashboard` route, permanently redirected to `/home`. */

import { redirect } from 'next/navigation';

export default function DashboardRedirectPage() {
  redirect('/home');
}
