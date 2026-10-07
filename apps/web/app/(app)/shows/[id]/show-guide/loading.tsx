/** Loading skeleton for the show-guide tab. */

import { ListSkeleton } from '@/ui/shell/RouteSkeletons';

export default function ShowGuideLoading() {
  return (
    <div className="w-full min-w-0" role="status" aria-busy="true" aria-label="Loading show guide">
      <ListSkeleton rows={8} />
    </div>
  );
}
