import { SectionHeader } from '@/ui/patterns/SectionHeader';
import { KitGallery } from './_components/KitGallery';

/** Reference sheet for the UI kit's motion and showcase components, with example data. */
export default function UiKitPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        as="h1"
        title="UI kit"
        description="Motion and showcase components for marketing and browse pages, shown with example data."
      />
      <KitGallery />
    </div>
  );
}
