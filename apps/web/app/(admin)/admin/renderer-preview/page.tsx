import { SectionHeader } from '@/ui/patterns/SectionHeader';
import { RendererPreview } from './_components/RendererPreview';

/** Presents the renderer library within the permission-checked admin workspace. */
export default function RendererPreviewPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        as="h1"
        title="Renderer preview"
        description="Explore the effect library with playback, sound and poster stills. Shows use the existing renderer."
      />
      <RendererPreview />
    </div>
  );
}
