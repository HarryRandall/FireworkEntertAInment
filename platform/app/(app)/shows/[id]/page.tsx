import { redirect } from 'next/navigation';

type PageProps = { params: Promise<{ id: string }> };

export default async function ShowIndexPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/shows/${id}/preview`);
}
