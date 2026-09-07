/** Settings index page redirecting to the first user-facing settings section. */

import { redirect } from 'next/navigation';

export default function SettingsPage() {
  redirect('/settings/profile');
}
