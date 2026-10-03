/** Supplier navigation, grouped by the prototype's rail sections. */
import { FileSpreadsheet, Package, Video } from 'lucide-react';
import type { AreaConfig } from './types';

/** Routes and shortcuts presented in the supplier workspace. */
export const supplierConfig: AreaConfig = {
  area: 'supplier',
  label: 'Supplier',
  href: '/supplier',
  initials: 'SU',
  sections: [
    {
      label: 'Price lists',
      icon: FileSpreadsheet,
      items: [
        { label: 'Price lists', href: '/supplier' },
        { label: 'Submissions', href: '/supplier/submissions' },
      ],
      shortcuts: [{ label: 'Upload price list', href: '/supplier/submissions' }],
    },
    {
      label: 'Products',
      icon: Package,
      items: [
        { label: 'Products', href: '/supplier/products' },
        { label: 'Safety data', href: '/supplier/safety' },
      ],
      shortcuts: [],
    },
    {
      label: 'Videos',
      icon: Video,
      items: [{ label: 'Videos', href: '/supplier/videos' }],
      shortcuts: [],
    },
  ],
};
