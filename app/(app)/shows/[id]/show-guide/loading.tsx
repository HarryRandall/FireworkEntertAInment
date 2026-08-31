/** Loading skeleton for the show-guide tab. */

import { ListSkeleton } from '@/app/components/app/RouteSkeletons';

export default function ShowGuideLoading() {
  return (
    <div className="max-w-3xl" aria-label="Loading show guide">
      <ListSkeleton rows={8} />
    </div>
  );
}
