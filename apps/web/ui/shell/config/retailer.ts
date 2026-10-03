/** Retailer navigation, grouped by the prototype's rail sections. */
import { Boxes, ChartNoAxesCombined, Home, Play, Settings } from 'lucide-react';
import type { AreaConfig } from './types';

/** Routes and shortcuts presented in the retailer workspace. */
export const retailerConfig: AreaConfig = {
  area: 'retailer',
  label: 'Retailer',
  href: '/retailer',
  initials: 'HF',
  sections: [
    {
      label: 'Home',
      icon: Home,
      items: [{ label: 'Overview', href: '/retailer' }],
      shortcuts: [
        { label: 'New show', href: '/retailer/shows' },
        { label: 'Create a QR code', href: '/retailer/qr-codes' },
        { label: 'Print shelf labels', href: '/retailer/labels' },
      ],
    },
    {
      label: 'Shows and QR codes',
      icon: Play,
      items: [
        { label: 'Shows', href: '/retailer/shows' },
        { label: 'QR codes', href: '/retailer/qr-codes' },
        { label: 'Campaigns', href: '/retailer/campaigns' },
        { label: 'Shelf labels', href: '/retailer/labels' },
      ],
      shortcuts: [{ label: 'Bonfire season', href: '/retailer/campaigns' }],
    },
    {
      label: 'Range',
      icon: Boxes,
      items: [
        { label: 'Assortments', href: '/retailer/range' },
        { label: 'Products', href: '/retailer/products' },
        { label: 'Stock', href: '/retailer/stock' },
      ],
      shortcuts: [{ label: 'Running low', href: '/retailer/stock' }],
    },
    {
      label: 'Insights',
      icon: ChartNoAxesCombined,
      items: [
        { label: 'Overview', href: '/retailer/insights' },
        { label: 'Events', href: '/retailer/events' },
        { label: 'Customers', href: '/retailer/customers' },
        { label: 'Saved reports', href: '/retailer/reports' },
      ],
      shortcuts: [{ label: 'Bonfire week', href: '/retailer/reports' }],
    },
    {
      label: 'Settings',
      icon: Settings,
      items: [
        { label: 'Store', href: '/retailer/settings' },
        { label: 'Locations', href: '/retailer/locations' },
        { label: 'Branding', href: '/retailer/branding' },
        { label: 'Team', href: '/retailer/team' },
        { label: 'Credits and billing', href: '/retailer/credits' },
        { label: 'Notifications', href: '/retailer/notifications' },
        { label: 'Integrations', href: '/retailer/integrations' },
      ],
      shortcuts: [],
    },
  ],
};
