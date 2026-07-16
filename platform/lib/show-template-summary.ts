import type { ShowTemplate } from '@/lib/admin.types';

/** Public list-card data. Cue timelines are loaded only by a scoped preview or detail read. */
export type ShowTemplateSummary = Omit<ShowTemplate, 'previewCues'> & {
  compositionSignature: string;
};
