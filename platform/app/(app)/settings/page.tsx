/** Settings index page summarising account preferences and linking to sub-pages. */

import { redirect } from 'next/navigation';

export default function SettingsPage() {
  redirect('/settings/profile');
}
