'use client';

/**
 * MarketingNavBar provides sticky, blurred top navigation for the public
 * marketing site. Desktop shows hover and focus menus for "How it works" and
 * "Features"; the signed-in state is resolved on the client so the
 * "Home" CTA can swap in for unauthenticated visitors.
 */
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import {
  ChevronDown,
  ListChecks,
  Menu,
  Music4,
  ShoppingBag,
  Sparkles,
  SlidersHorizontal,
  Wand2,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { BrandLockup } from '@/components/design-system/BrandMark';
import { Container } from '@/components/design-system/Container';
import { Button } from '@/components/design-system/Button';
import { createClient } from '@/utils/supabase/client';
import styles from './navigation.module.css';

type MenuItem = { t: string; d: string; href: string; Icon: LucideIcon };

const HOW_ITEMS: MenuItem[] = [
  {
    t: 'Pick a song',
    d: 'Upload audio for beat and section analysis',
    href: '/how-it-works',
    Icon: Music4,
  },
  {
    t: 'Describe the show',
    d: 'Set the budget, venue and creative direction',
    href: '/how-it-works',
    Icon: SlidersHorizontal,
  },
  {
    t: 'Generate the timeline',
    d: 'Create cues only when you press Generate',
    href: '/how-it-works',
    Icon: Wand2,
  },
  {
    t: 'Review the plan',
    d: 'Preview cues and check the shopping list',
    href: '/how-it-works',
    Icon: ShoppingBag,
  },
];

const FEATURE_ITEMS: MenuItem[] = [
  {
    t: 'Audio analysis',
    d: 'Tempo, sections and musical structure',
    href: '/features',
    Icon: Music4,
  },
  {
    t: 'Cue planning',
    d: 'Fast deterministic planning by default',
    href: '/features',
    Icon: ListChecks,
  },
  {
    t: 'Catalogue products',
    d: 'Browse fireworks available for show plans',
    href: '/catalogue',
    Icon: ShoppingBag,
  },
  {
    t: 'Explore templates',
    d: 'Start from published curated presets',
    href: '/library',
    Icon: Sparkles,
  },
];

const FLAT_LINKS: { href: string; label: string }[] = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/library', label: 'Explore' },
  { href: '/catalogue', label: 'Catalogue' },
];

function NavMenu({ label, href, items }: { label: string; href: string; items: MenuItem[] }) {
  return (
    <div className={styles.menu}>
      <Link href={href} className={styles.pill}>
        {label} <ChevronDown aria-hidden="true" size={13} strokeWidth={2.2} />
      </Link>
      <ul className={`${styles.menuPanel} m-0 list-none`}>
        {items.map((it) => (
          <li key={`${label}-${it.t}`}>
            <Link href={it.href} className={styles.menuItem}>
              <span className={styles.menuItemIcon}>
                <it.Icon aria-hidden="true" size={16} strokeWidth={1.9} />
              </span>
              <span>
                <span className="text-on-surface block text-sm font-semibold">{it.t}</span>
                <span className="text-on-surface-variant mt-px block text-[12.5px] leading-snug">
                  {it.d}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MarketingNavBar() {
  const [open, setOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const mobileMenuId = useId();
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;

      event.preventDefault();
      setOpen(false);
      mobileMenuTriggerRef.current?.focus();
    }

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  return (
    <nav className="border-outline-variant/60 sticky top-0 z-50 border-b bg-[color-mix(in_srgb,var(--background)_80%,transparent)] backdrop-blur-xl">
      <Container className="flex h-[66px] items-center justify-between">
        <Link href={authenticated ? '/home' : '/'} className="text-on-surface">
          <BrandLockup />
        </Link>

        <div className="hidden items-center gap-0.5 lg:flex">
          <NavMenu label="How it works" href="/how-it-works" items={HOW_ITEMS} />
          <NavMenu label="Features" href="/features" items={FEATURE_ITEMS} />
          <Link href="/pricing" className={styles.pill}>
            Pricing
          </Link>
          <Link href="/catalogue" className={styles.pill}>
            Catalogue
          </Link>
        </div>

        <div className="hidden items-center gap-2.5 lg:flex">
          {authenticated ? (
            <Button href="/home" size="sm" className={styles.authButton}>
              Home
            </Button>
          ) : (
            <>
              <Link href="/login" className={styles.authLink}>
                Log in
              </Link>
              <Button href="/signup" size="sm" className={styles.authButton}>
                Sign up free
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <button
            ref={mobileMenuTriggerRef}
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-controls={mobileMenuId}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="border-outline-variant/60 bg-background text-on-surface-variant hover:text-on-surface focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border outline-none focus-visible:ring-3"
          >
            {open ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
          </button>
        </div>
      </Container>

      <div
        id={mobileMenuId}
        data-state={open ? 'open' : 'closed'}
        aria-hidden={!open}
        inert={!open}
        className={`${styles.mobileMenu} border-outline-variant/60 bg-background border-t lg:hidden`}
      >
        <Container className="flex flex-col gap-1 py-4">
          {FLAT_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-on-surface-variant hover:bg-muted hover:text-on-surface rounded-lg px-3 py-3 text-base font-medium"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="border-outline-variant/60 mt-3 flex flex-col gap-3 border-t pt-4">
            {authenticated ? (
              <Button href="/home" size="md" className="w-full" onClick={() => setOpen(false)}>
                Home
              </Button>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-on-surface-variant hover:bg-muted rounded-lg px-3 py-3 text-base font-medium"
                  onClick={() => setOpen(false)}
                >
                  Log in
                </Link>
                <Button href="/signup" size="md" className="w-full" onClick={() => setOpen(false)}>
                  Sign up free
                </Button>
              </>
            )}
          </div>
        </Container>
      </div>
    </nav>
  );
}
