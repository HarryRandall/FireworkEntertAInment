"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Sparkles } from "lucide-react";
import { Container } from "@/app/components/ui/Container";
import { Button } from "@/app/components/ui/Button";
import { ThemeToggle } from "@/app/components/theme/ThemeToggle";
import { cn } from "@/lib/cn";
import { createClient } from "@/utils/supabase/client";

type NavLink = { href: string; label: string };

type MarketingNavBarProps = {
  links?: NavLink[];
  ctaHref?: string;
  ctaLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  isAuthenticated?: boolean;
  dashboardHref?: string;
  dashboardLabel?: string;
};

export function MarketingNavBar({
  links = [],
  ctaHref = "/signup",
  ctaLabel = "Sign up free",
  secondaryHref = "/login",
  secondaryLabel = "Log in",
  isAuthenticated = false,
  dashboardHref = "/dashboard",
  dashboardLabel = "Dashboard",
}: MarketingNavBarProps) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(isAuthenticated);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let active = true;

    try {
      const supabase = createClient();

      supabase.auth.getUser().then(({ data }) => {
        if (active) setAuthenticated(Boolean(data.user));
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (active) setAuthenticated(Boolean(session?.user));
      });

      return () => {
        active = false;
        subscription.unsubscribe();
      };
    } catch {
      return () => {
        active = false;
      };
    }
  }, []);

  const hasLinks = links.length > 0;

  return (
    <nav
      className={cn(
        "fixed top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "border-b border-outline-variant/15 bg-surface/70 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <Container className="flex h-16 items-center justify-between">
        <Link
          href={authenticated ? dashboardHref : "/"}
          className="group flex items-center gap-2 text-xl font-semibold tracking-tighter text-on-surface"
        >
          <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary transition-transform duration-300 group-hover:rotate-12">
            <Sparkles size={14} strokeWidth={2} />
            <span
              aria-hidden
              className="absolute inset-0 -z-10 rounded-full bg-primary/40 blur-md"
            />
          </span>
          <span>
            Show<span className="text-primary">Crafter</span>
          </span>
        </Link>

        {hasLinks ? (
          <div
            className="hidden items-center gap-1 md:flex"
            onPointerLeave={() => setHovered(null)}
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onPointerEnter={() => setHovered(link.href)}
                className="relative rounded-full px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
              >
                {hovered === link.href && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 -z-10 rounded-full bg-surface-container-highest/60"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="hidden items-center gap-3 md:flex">
          {authenticated ? (
            <Button href={dashboardHref} size="sm">
              {dashboardLabel}
            </Button>
          ) : (
            <>
              <Link
                href={secondaryHref}
                className="text-sm font-medium text-on-surface-variant transition-colors hover:text-primary"
              >
                {secondaryLabel}
              </Link>
              <Button href={ctaHref} size="sm">
                {ctaLabel}
              </Button>
            </>
          )}
          <ThemeToggle />
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant/30 bg-surface-container/60 text-on-surface-variant hover:text-primary"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <ThemeToggle />
        </div>
      </Container>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden border-t border-outline-variant/15 bg-surface md:hidden"
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
              <div
                className={cn(
                  "flex flex-col gap-3",
                  hasLinks && "mt-3 border-t border-outline-variant/10 pt-4",
                )}
              >
                {authenticated ? (
                  <Button
                    href={dashboardHref}
                    size="md"
                    className="w-full"
                    onClick={() => setOpen(false)}
                  >
                    {dashboardLabel}
                  </Button>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </Container>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
