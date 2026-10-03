/** Serialisable catalogue rows and version previews shared by server loaders and grids. */
import type { Design } from '@showcrafter/fireworks';
import type { Shot } from '@showcrafter/fireworks/view';

/** One poster request, rendered through the package's shared surface. */
export interface CataloguePreview {
  design: Design;
  shots?: Shot[];
}
/** A searchable catalogue parent without editable document state. */
export interface CatalogueRow {
  id: string;
  name: string;
  kind: string;
  status: string;
  href: string;
  updated: string;
  description: string;
  preview: CataloguePreview | null;
}
/** Immutable history metadata, ordered newest first by the loader. */
export interface CatalogueVersion {
  id: string;
  number: number;
  status: string;
  note: string | null;
  created: string;
  published: string | null;
  preview: CataloguePreview | null;
}
/** Actual dependencies of the selected catalogue item. */
export interface CatalogueUsage {
  id: string;
  name: string;
  href?: string;
  detail: string;
}
