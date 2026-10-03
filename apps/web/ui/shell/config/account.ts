/** Shopper account navigation, grouped by the prototype's rail sections. */
import { Home, Play, Settings, ShoppingBasket, Store } from 'lucide-react';
import type { AreaConfig } from './types';

/** Routes and shortcuts presented in the shopper account workspace. */
export const accountConfig: AreaConfig = {
  area: 'account',
  label: 'Shopper account',
  href: '/account',
  initials: 'ME',
  sections: [
    {
      label: 'Overview',
      icon: Home,
      items: [{ label: 'Overview', href: '/account' }],
      shortcuts: [],
    },
    {
      label: 'Saved shows',
      icon: Play,
      items: [{ label: 'Saved shows', href: '/account/shows' }],
      shortcuts: [],
    },
    {
      label: 'Lists',
      icon: ShoppingBasket,
      items: [{ label: 'Lists', href: '/account/lists' }],
      shortcuts: [],
    },
    {
      label: 'Followed shops',
      icon: Store,
      items: [{ label: 'Followed shops', href: '/account/shops' }],
      shortcuts: [],
    },
    {
      label: 'Settings',
      icon: Settings,
      items: [{ label: 'Settings', href: '/account/settings' }],
      shortcuts: [],
    },
  ],
};
