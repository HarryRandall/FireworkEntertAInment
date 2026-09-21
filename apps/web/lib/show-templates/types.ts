import type { ShowCover } from '@/lib/cover';

export type ShowTemplateCue = {
  timeSeconds: number;
  description: string;
  fireworkSlug?: string;
  catalogueItemId?: string | null;
  catalogueItemSlug?: string | null;
  launchPositionIndex: number;
  emphasis: 'normal' | 'accent' | 'peak';
};

export type ShowTemplate = {
  id: string;
  slug: string;
  title: string;
  theme: string;
  description: string | null;
  durationSeconds: number | null;
  budgetCents: number | null;
  totalCents: number;
  effectsCount: number;
  timeOfDay: string | null;
  moodTags: string[];
  previewCues: ShowTemplateCue[];
  coverShader: ShowCover | null;
  /** Storage path of the pre-rendered cover image; null until rendered. */
  coverImagePath: string | null;
  isFeatured: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  sortOrder: number;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
};
