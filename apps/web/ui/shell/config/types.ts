/** Navigation contracts shared by area configurations and the workspace chrome. */
import type { LucideIcon } from 'lucide-react';

/** Area keys match the route and access-policy boundary. */
export type WorkspaceArea = 'retailer' | 'admin' | 'supplier' | 'account';
/** A destination within one workspace area. */
export interface NavItem {
  label: string;
  href: string;
}
/** A rail section and its sidebar destinations. */
export interface NavSection {
  label: string;
  icon: LucideIcon;
  items: readonly NavItem[];
  shortcuts: readonly NavItem[];
}
/** One area's navigation and identity presentation. */
export interface AreaConfig {
  area: WorkspaceArea;
  label: string;
  href: string;
  initials: string;
  sections: readonly NavSection[];
}
/** Presentation filtering only, never an access boundary. */
export interface ShellVisibility {
  area?: (area: WorkspaceArea) => boolean;
  item?: (item: NavItem, area: WorkspaceArea) => boolean;
}
