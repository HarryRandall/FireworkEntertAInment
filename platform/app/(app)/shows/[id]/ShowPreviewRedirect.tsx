'use client';

/** Client bridge from the legacy show detail URL to the canonical preview tab. */

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

type ShowParams = {
  id?: string | string[];
};

export function ShowPreviewRedirect() {
  const router = useRouter();
  const params = useParams<ShowParams>();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  useEffect(() => {
    if (!id) return;
    router.replace(`/shows/${encodeURIComponent(id)}/preview`);
  }, [id, router]);

  return null;
}
