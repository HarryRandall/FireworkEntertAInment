import 'server-only';

import { listShowTemplates } from '@/lib/admin.server';
import type { ShowTemplate } from '@/lib/admin.types';
import { listShowsForCurrentUser } from '@/lib/shows.server';
import type { Show } from '@/lib/show-domain';
import {
  mapShowToSummary,
  mapTemplateToSummary,
  type DashboardSummary,
  type TemplateSummaryCard,
  type WorkspaceSummary,
} from '@/lib/show-summary';

function pickFeaturedTemplate(templates: TemplateSummaryCard[]): TemplateSummaryCard | null {
  return (
    templates.find((template) => template.isFeatured) ??
    [...templates].sort((a, b) => b.likes - a.likes)[0] ??
    null
  );
}

function buildDashboardSummary(shows: Show[], templates: ShowTemplate[]): DashboardSummary {
  const showSummaries = shows.map(mapShowToSummary);
  const templateSummaries = templates.map(mapTemplateToSummary);
  const totalRuntimeSeconds = showSummaries.reduce(
    (total, show) => total + (show.lengthSeconds ?? 0),
    0,
  );
  const totalCatalogueValueCents = showSummaries.reduce(
    (total, show) => total + show.totalCostCents,
    0,
  );

  return {
    showCount: showSummaries.length,
    totalRuntimeSeconds,
    totalCatalogueValueCents,
    recentShows: showSummaries.slice(0, 5),
    featuredTemplate: pickFeaturedTemplate(templateSummaries),
    allShows: showSummaries,
    communityTemplates: [...templateSummaries]
      .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || b.likes - a.likes)
      .slice(0, 3),
  };
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [shows, templates] = await Promise.all([listShowsForCurrentUser(), listShowTemplates()]);
  return buildDashboardSummary(shows, templates);
}

export async function getDashboardSummaryWithTemplates(): Promise<{
  summary: DashboardSummary;
  templates: ShowTemplate[];
}> {
  const [shows, templates] = await Promise.all([listShowsForCurrentUser(), listShowTemplates()]);
  return {
    summary: buildDashboardSummary(shows, templates),
    templates,
  };
}

export async function getWorkspaceSummary(): Promise<WorkspaceSummary> {
  const summary = await getDashboardSummary();
  return {
    showCount: summary.showCount,
    totalRuntimeSeconds: summary.totalRuntimeSeconds,
    totalCatalogueValueCents: summary.totalCatalogueValueCents,
    recentShows: summary.recentShows.slice(0, 3),
    featuredTemplate: summary.featuredTemplate,
  };
}
