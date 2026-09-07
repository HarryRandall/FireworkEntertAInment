'use client';

import Link from 'next/link';
import { BrandLockup } from '@/components/design-system/BrandMark';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { isPlainLeftClick, SIDEBAR_BRAND_BUTTON_CLASS } from './shell-utils';

const SIDEBAR_HEADER_TRIGGER_CLASS =
  'h-10 w-10 shrink-0 self-center cursor-pointer rounded-md bg-transparent text-sidebar-accent-foreground opacity-100 shadow-none transition-[opacity,background-color,color] duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-none active:translate-y-0 active:not-aria-[haspopup]:translate-y-0 dark:hover:bg-sidebar-accent [&_svg]:size-5 group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:top-0 group-data-[collapsible=icon]:left-1/2 group-data-[collapsible=icon]:right-auto group-data-[collapsible=icon]:z-10 group-data-[collapsible=icon]:-translate-x-1/2 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:text-sidebar-accent-foreground group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:shadow-none group-data-[collapsible=icon]:group-hover/brand:pointer-events-auto group-data-[collapsible=icon]:group-hover/brand:opacity-100 group-data-[collapsible=icon]:focus-visible:pointer-events-auto group-data-[collapsible=icon]:focus-visible:opacity-100';

export function SidebarBrand({
  href,
  onNavigate,
}: {
  href: '/home' | '/admin' | '/my-store';
  onNavigate?: (href: string) => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <div className="group/brand relative flex min-w-0 items-center gap-1 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:justify-center">
      <SidebarMenu className="min-w-0 flex-1 group-data-[collapsible=icon]:flex-none">
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            size="lg"
            tooltip="ShowCrafter"
            className={SIDEBAR_BRAND_BUTTON_CLASS}
          >
            <Link
              href={href}
              prefetch={false}
              onClick={(event) => {
                if (isPlainLeftClick(event)) onNavigate?.(href);
                if (isMobile) setOpenMobile(false);
              }}
            >
              <BrandLockup
                className="w-full gap-0 text-lg group-data-[collapsible=icon]:justify-center"
                markClassName="group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:translate-y-0"
                labelClassName="group-data-[collapsible=icon]:hidden"
              />
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <SidebarTrigger className={SIDEBAR_HEADER_TRIGGER_CLASS} />
    </div>
  );
}
