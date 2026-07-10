/**
 * Group-level loading fallback for admin routes.
 *
 * Every admin subroute defines its own route-shaped `loading.tsx`, so this
 * boundary only shows while the admin shell itself cold-loads (e.g. first
 * entry into /admin from the app). It is deliberately neutral: the previous
 * version picked a skeleton with `usePathname()`, but during a transition the
 * hook still reports the old route, so leaving /admin flashed the overview
 * skeleton on the way to every subpage. Neutral placeholders cannot flash the
 * wrong page shape.
 */

import { Skeleton } from '@/app/components/ui/Feedback';

export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-label="Loading admin data">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-72" />
      </div>
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-[420px] rounded-xl" />
    </div>
  );
}
