/** Legacy show detail URL, redirected to the canonical preview tab. */

import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ShowIndexPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/shows/${encodeURIComponent(id)}/preview`);
}
