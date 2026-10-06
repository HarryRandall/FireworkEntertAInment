'use client';

import dynamic from 'next/dynamic';
import { InlineAlert } from '@/ui/patterns/Feedback';

const PreviewLibrary = dynamic(() => import('./PreviewLibrary'), {
  ssr: false,
  loading: () => <InlineAlert title="Loading renderer" />,
});

/** Loads WebGL and template validation only in the browser on this page. */
export function RendererPreview() {
  return <PreviewLibrary />;
}
