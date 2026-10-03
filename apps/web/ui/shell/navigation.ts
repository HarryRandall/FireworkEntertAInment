/** Route matching and visibility shared by sidebar, rail and command search. */
import type { AreaConfig, NavItem, NavSection, ShellVisibility } from './config/types';

/** Finds a configured route without treating a neighbouring prefix as a match. */
export function currentItem(config: AreaConfig, pathname: string): NavItem | undefined {
  return (
    config.sections.flatMap((section) => section.items).find((item) => item.href === pathname) ??
    config.sections.flatMap((section) => section.shortcuts).find((item) => item.href === pathname)
  );
}
/** Finds the active rail section, falling back to the area's landing section. */
export function currentSection(config: AreaConfig, pathname: string): NavSection {
  return (
    config.sections.find((section) => section.items.some((item) => item.href === pathname)) ??
    config.sections.find((section) => section.shortcuts.some((item) => item.href === pathname)) ??
    config.sections[0]
  );
}
/** Filters destinations for presentation using the caller's access policy. */
export function visibleSections(
  config: AreaConfig,
  visibility?: ShellVisibility,
): readonly NavSection[] {
  if (visibility?.area?.(config.area) === false) return [];
  return config.sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => visibility?.item?.(item, config.area) !== false),
      shortcuts: section.shortcuts.filter(
        (item) => visibility?.item?.(item, config.area) !== false,
      ),
    }))
    .filter((section) => section.items.length > 0);
}

/** Resolves filtered navigation and the breadcrumb for one route or review path. */
export function shellNavigation(
  config: AreaConfig,
  pathname: string,
  visibility?: ShellVisibility,
) {
  const sections = visibleSections(config, visibility);
  const active = currentSection(config, pathname);
  const section = sections.find((item) => item.label === active.label) ?? sections.at(0);
  const title = currentItem(config, pathname)?.label ?? section?.label ?? config.label;
  return { sections, section, title };
}
