/** Preserve the legacy vendor URL while catalogue content lives at `/catalogue`. */

import { redirect } from 'next/navigation';

export default function VendorsPage() {
  redirect('/catalogue');
}
