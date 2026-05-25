'use client';

/**
 * MarketingNavBar — top navigation rendered across public marketing
 * routes. Resolves the signed-in state on the client via Supabase so
 * the "Dashboard" CTA can swap in for unauthenticated visitors.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Sparkles } from 'lucide-react';
import { Container } from '@/app/components/ui/Container';
import { Button } from '@/app/components/ui/Button';
import { ThemeToggle } from '@/app/components/theme/ThemeToggle';
import { cn } from '@/lib/utils';
import { createClient } from '@/utils/supabase/client';

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
  ctaHref = '/signup',
  ctaLabel = 'Sign up free',
  secondaryHref = '/login',
  secondaryLabel = 'Log in',
  isAuthenticated = false,
  dashboardHref = '/dashboard',
  dashboardLabel = 'Dashboard',
}: MarketingNavBarProps) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(isAuthenticated);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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
        'fixed top-0 z-50 w-full transition-all duration-300',
        scrolled
          ? 'border-outline-variant/15 bg-surface/70 border-b backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <Container className="flex h-16 items-center justify-between">
        <Link
          href={authenticated ? dashboardHref : '/'}
          className="group text-on-surface flex items-center gap-2 text-xl font-semibold tracking-tighter"
        >
          <span className="bg-primary/15 text-primary relative inline-flex h-7 w-7 items-center justify-center rounded-full transition-transform duration-300 group-hover:rotate-12">
            <Sparkles size={14} strokeWidth={2} />
            <span
              aria-hidden
              className="bg-primary/40 absolute inset-0 -z-10 rounded-full blur-md"
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
                className="text-on-surface-variant hover:text-on-surface relative rounded-full px-4 py-2 text-sm font-medium transition-colors"
              >
                {hovered === link.href && (
                  <motion.span
                    layoutId="nav-pill"
                    className="bg-surface-container-highest/60 absolute inset-0 -z-10 rounded-full"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
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
                className="text-on-surface-variant hover:text-primary text-sm font-medium transition-colors"
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
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="border-outline-variant/30 bg-surface-container/60 text-on-surface-variant hover:text-primary inline-flex h-11 w-11 items-center justify-center rounded-full border"
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
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="border-outline-variant/15 bg-surface overflow-hidden border-t md:hidden"
          >
            <Container className="flex flex-col gap-1 py-4">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-on-surface-variant hover:bg-surface-container-highest/50 hover:text-primary rounded-lg px-3 py-3 text-base font-medium"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div
                className={cn(
                  'flex flex-col gap-3',
                  hasLinks && 'border-outline-variant/10 mt-3 border-t pt-4',
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
                      className="text-on-surface-variant hover:bg-surface-container-highest/50 rounded-lg px-3 py-3 text-base font-medium"
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
