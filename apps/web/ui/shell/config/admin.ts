/** Admin navigation, grouped by the prototype's rail sections. */
import { Flame, Gauge, Home, Store, Users } from 'lucide-react';
import type { AreaConfig } from './types';

/** Routes and shortcuts presented in the admin workspace. */
export const adminConfig: AreaConfig = {
  area: 'admin',
  label: 'Admin',
  href: '/admin',
  initials: 'SC',
  sections: [
    {
      label: 'Overview',
      icon: Home,
      items: [{ label: 'Overview', href: '/admin' }],
      shortcuts: [
        { label: 'Import lines to match', href: '/admin/review' },
        { label: 'Fireworks to approve', href: '/admin/qa' },
      ],
    },
    {
      label: 'Catalogue',
      icon: Flame,
      items: [
        { label: 'Effects', href: '/admin/catalogue' },
        { label: 'Posters', href: '/admin/posters' },
        { label: 'Products', href: '/admin/products' },
        { label: 'Multishots', href: '/admin/multishots' },
        { label: 'Imports', href: '/admin/imports' },
        { label: 'Suppliers', href: '/admin/suppliers' },
        { label: 'Import review', href: '/admin/review' },
        { label: 'Quality assurance', href: '/admin/qa' },
      ],
      shortcuts: [
        { label: 'Firework Studio', href: '/admin/studio' },
        { label: 'Multishot editor', href: '/admin/multishot-editor' },
      ],
    },
    {
      label: 'Retailers and billing',
      icon: Store,
      items: [
        { label: 'Retailers', href: '/admin/retailers' },
        { label: 'Revenue', href: '/admin/billing' },
        { label: 'Plans', href: '/admin/plans' },
        { label: 'Invoices', href: '/admin/invoices' },
        { label: 'Credit packs', href: '/admin/credit-packs' },
      ],
      shortcuts: [],
    },
    {
      label: 'People',
      icon: Users,
      items: [
        { label: 'Users', href: '/admin/people' },
        { label: 'Roles', href: '/admin/roles' },
        { label: 'Support sessions', href: '/admin/support' },
      ],
      shortcuts: [],
    },
    {
      label: 'Platform',
      icon: Gauge,
      items: [
        { label: 'Usage and costs', href: '/admin/platform' },
        { label: 'AI planner', href: '/admin/ai' },
        { label: 'Feature flags', href: '/admin/flags' },
        { label: 'Audit log', href: '/admin/audit' },
        { label: 'Settings', href: '/admin/settings' },
        { label: 'Integrations', href: '/admin/integrations' },
      ],
      shortcuts: [],
    },
  ],
};
