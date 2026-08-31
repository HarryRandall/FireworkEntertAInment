/** Legacy `/recommendations` route - redirects to the new `/library`. */

import { redirect } from 'next/navigation';

export default async function RecommendationsPage() {
  redirect('/library');
}
