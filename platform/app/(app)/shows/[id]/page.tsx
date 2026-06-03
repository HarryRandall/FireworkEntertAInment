/** Show detail landing page (the overview tab for a single show). */

import { ReplayPanelSkeleton } from '@/app/components/app/RouteSkeletons';
import { ShowPreviewRedirect } from './ShowPreviewRedirect';

export default function ShowIndexPage() {
  return (
    <>
      <ShowPreviewRedirect />
      <ReplayPanelSkeleton />
    </>
  );
}
