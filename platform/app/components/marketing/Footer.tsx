import Link from "next/link";
import { Code2, Sparkles } from "lucide-react";
import { Container } from "@/app/components/ui/Container";

const PRODUCT_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/shows/new", label: "Create a show" },
];

const SOCIAL = [
  {
    href: "https://github.com/HarryRandall/FireworkEntertAInment",
    label: "Source code",
    icon: Code2,
  },
];

export function MarketingFooter() {
  return (
    <footer className="relative mt-auto w-full bg-surface-container-lowest pb-10 pt-20">
      <div className="ember-divider absolute inset-x-0 top-0" />
      <Container>
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
          <div className="md:col-span-7">
            <Link
              href="/"
              className="group inline-flex items-center gap-2 text-xl font-semibold tracking-tighter text-on-surface"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Sparkles size={14} strokeWidth={2} />
              </span>
              Show<span className="text-primary">Crafter</span>
            </Link>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-on-surface-variant">
              AI choreography for real consumer fireworks. Built with ICON
              Pyrotechnics — pick a song, set a budget, light up the sky.
            </p>
            <div className="mt-6 flex items-center gap-2">
              {SOCIAL.map(({ href, label, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/25 bg-surface-container/60 text-on-surface-variant transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <Icon size={16} strokeWidth={1.75} />
                </a>
              ))}
            </div>
          </div>

          <div className="md:col-span-5">
            <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Product
            </h4>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-on-surface-variant transition-colors hover:text-primary"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-outline-variant/15 pt-8 md:flex-row">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant/60">
            &copy; 2026 ShowCrafter AI · COMP3500 · ICON Pyrotechnics International
          </p>
          <p className="text-xs uppercase tracking-widest text-on-surface-variant/40">
            Designed for the night sky
          </p>
        </div>
      </Container>
    </footer>
  );
}
