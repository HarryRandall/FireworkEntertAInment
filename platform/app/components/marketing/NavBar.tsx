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
  Menu,
  Music4,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  SlidersHorizontal,
  Wand2,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Container } from '@/app/components/ui/Container';
import { Button } from '@/app/components/ui/Button';
import { createClient } from '@/utils/supabase/client';

type MenuItem = { t: string; d: string; href: string; Icon: LucideIcon };

const HOW_ITEMS: MenuItem[] = [
  {
    t: 'Pick a song',
    d: 'Upload audio, we read the tempo & drops',
    href: '/how-it-works',
    Icon: Music4,
  },
  {
    t: 'Set a budget',
    d: 'Spend cap, venue size and finale weight',
    href: '/how-it-works',
    Icon: SlidersHorizontal,
  },
  {
    t: 'AI choreography',
    d: 'Every cue mapped to a real product',
    href: '/how-it-works',
    Icon: Wand2,
  },
  {
    t: 'Buy & fire',
    d: 'Shopping list + timed click-track',
    href: '/how-it-works',
    Icon: ShoppingBag,
  },
];

const FEATURE_ITEMS: MenuItem[] = [
  { t: 'Audio analyser', d: 'Beats, drops and harmonic peaks', href: '/features', Icon: Music4 },
  {
    t: 'Safety engine',
    d: 'Minimum safe-distance on every cue',
    href: '/features',
    Icon: ShieldCheck,
  },
  {
    t: 'Local inventory',
    d: 'Only products your store stocks',
    href: '/vendors',
    Icon: ShoppingBag,
  },
  { t: 'Show gallery', d: 'Remix shows from the community', href: '/features', Icon: Sparkles },
];

const FLAT_LINKS: { href: string; label: string }[] = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/vendors', label: 'Vendors' },
];

function NavMenu({ label, href, items }: { label: string; href: string; items: MenuItem[] }) {
  return (
    <div className="lp-menu">
      <Link href={href} className="lp-nav-pill">
        {label} <ChevronDown size={13} strokeWidth={2.2} />
      </Link>
      <ul className="lp-menu-panel m-0 list-none">
        {items.map((it) => (
          <li key={`${label}-${it.t}`}>
            <Link href={it.href} className="lp-menu-item">
              <span className="lp-menu-item__ic">
                <it.Icon size={16} strokeWidth={1.9} />
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
        <Link
          href={authenticated ? '/home' : '/'}
          className="text-on-surface flex items-center gap-2.5 text-xl font-semibold tracking-[-0.02em]"
        >
          <span className="brand-logo-mark h-[30px] w-[30px] rounded-[9px]">
            <Sparkles size={16} strokeWidth={2} />
          </span>
          ShowCrafter
        </Link>

        <div className="hidden items-center gap-0.5 lg:flex">
          <NavMenu label="How it works" href="/how-it-works" items={HOW_ITEMS} />
          <NavMenu label="Features" href="/features" items={FEATURE_ITEMS} />
          <Link href="/pricing" className="lp-nav-pill">
            Pricing
          </Link>
          <Link href="/vendors" className="lp-nav-pill">
            Vendors
          </Link>
        </div>

        <div className="hidden items-center gap-2.5 lg:flex">
          {authenticated ? (
            <Button href="/home" size="sm" className="lp-nav-auth-button">
              Home
            </Button>
          ) : (
            <>
              <Link href="/login" className="lp-nav-auth-link">
                Log in
              </Link>
              <Button href="/signup" size="sm" className="lp-nav-auth-button">
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
        className="lp-mobile-menu border-outline-variant/60 bg-background border-t lg:hidden"
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
