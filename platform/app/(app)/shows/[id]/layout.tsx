/** Show detail layout; loads the show by slug and renders the per-show tab navigation. */

import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { ShowDetailChrome } from './ShowDetailChrome';
import { getCurrentUserId } from '@/lib/current-user.server';
import { getShowBySlug } from '@/lib/shows.server';

type LayoutProps = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

export const maxDuration = 300;

export default async function ShowLayout({ children, params }: LayoutProps) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent(`/shows/${id}`)}`);
  }

  const show = await getShowBySlug(id);
  if (!show) {
    return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
  }

  return (
    <ShowDetailChrome
      showSlug={show.slug}
      showTitle={show.title}
      forceContentOnly={show.generationStatus === 'running'}
    >
      {children}
    </ShowDetailChrome>
  );
}
