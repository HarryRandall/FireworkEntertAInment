"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Container } from "@/app/components/ui/Container";
import { Button } from "@/app/components/ui/Button";
import { cn } from "@/lib/cn";

type NavLink = { href: string; label: string };

type MarketingNavBarProps = {
  links?: NavLink[];
  ctaHref?: string;
  ctaLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

const DEFAULT_LINKS: NavLink[] = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#features", label: "Features" },
];

export function MarketingNavBar({
  links = DEFAULT_LINKS,
  ctaHref = "/login",
  ctaLabel = "Get Started",
  secondaryHref = "/login",
  secondaryLabel = "Login",
}: MarketingNavBarProps) {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-outline-variant/10 bg-surface/80 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between">
        <Link
          href="/"
          className="text-xl font-semibold tracking-tighter text-primary"
        >
          ShowCrafter
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-on-surface-variant transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <Link
            href={secondaryHref}
            className="text-sm font-medium text-on-surface-variant transition-colors hover:text-primary"
          >
            {secondaryLabel}
          </Link>
          <Button href={ctaHref} size="sm">
            {ctaLabel}
          </Button>
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="md:hidden inline-flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-highest/50"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </Container>

      <div
        className={cn(
          "border-t border-outline-variant/10 bg-surface md:hidden",
          open ? "block" : "hidden",
        )}
      >
        <Container className="flex flex-col gap-1 py-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-3 text-base font-medium text-on-surface-variant hover:bg-surface-container-highest/50 hover:text-primary"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-3 flex flex-col gap-3 border-t border-outline-variant/10 pt-4">
            <Link
              href={secondaryHref}
              className="rounded-lg px-3 py-3 text-base font-medium text-on-surface-variant hover:bg-surface-container-highest/50"
              onClick={() => setOpen(false)}
            >
              {secondaryLabel}
            </Link>
            <Button
              href={ctaHref}
              size="md"
              className="w-full"
              onClick={() => setOpen(false)}
            >
              {ctaLabel}
            </Button>
          </div>
        </Container>
      </div>
    </nav>
  );
}
