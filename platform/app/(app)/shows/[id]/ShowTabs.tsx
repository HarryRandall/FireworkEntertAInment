"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

type Props = { id: string };

export function ShowTabs({ id }: Props) {
  const pathname = usePathname();
  const tabs = [
    { href: `/shows/${id}`, label: "Timeline" },
    { href: `/shows/${id}/shopping-list`, label: "Shopping list" },
    { href: `/shows/${id}/show-guide`, label: "Show guide" },
    { href: `/shows/${id}/preview`, label: "Live preview" },
  ];

  return (
    <nav className="flex flex-wrap items-center gap-x-8 gap-y-2 border-b border-outline-variant/10">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            prefetch
            className={cn(
              "pb-4 text-sm font-medium transition-colors",
              active
                ? "border-b-2 border-primary text-primary font-semibold"
                : "border-b-2 border-transparent text-on-surface-variant hover:text-on-surface",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
