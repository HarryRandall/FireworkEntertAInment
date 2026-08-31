/** Renderer demo followed by links into the product's documented planning workflow. */
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Container } from '@/components/design-system/Container';
import { Reveal } from './Reveal';
import { Doodle } from './landing/Doodle';
import { Eyebrow, ShowCard, Star4 } from './landing/decor';
import { ShowPreviewPanel } from './landing/ShowPreviewPanel';

const WORKFLOW_LINKS = [
  {
    title: 'Catalogue products',
    theme: 'Browse fireworks available for show planning',
    palette: ['var(--show-gold)', 'var(--show-rose)', 'var(--show-violet)'],
    action: 'Browse catalogue',
    href: '/catalogue',
  },
  {
    title: 'Curated templates',
    theme: 'Start from a published show preset',
    palette: ['var(--show-sky)', 'var(--show-violet)', 'var(--show-green)'],
    action: 'Explore templates',
    href: '/library',
  },
  {
    title: 'Cue timeline',
    theme: 'Generate a music-aware plan when you are ready',
    palette: ['var(--show-rose)', 'var(--show-gold)', 'var(--show-violet)'],
    action: 'See the flow',
    href: '/how-it-works',
  },
  {
    title: 'Shopping list',
    theme: 'Review products and quantities for the show',
    palette: ['var(--show-violet)', 'var(--show-sky)', 'var(--show-rose)'],
    action: 'See features',
    href: '/features',
  },
];

export function Showcase() {
  return (
    <section id="showcase" className="bg-muted border-outline-variant/60 border-t py-24 lg:py-28">
      <Container>
        <Reveal className="relative mb-10 max-w-[660px]">
          <Eyebrow>See it live</Eyebrow>
          <h2 className="text-on-surface mt-3 text-[clamp(34px,5vw,56px)] leading-[1.02] font-extrabold tracking-[-0.03em] text-balance">
            Watch a show come together.
          </h2>
          <p className="text-on-surface-variant mt-4 text-lg leading-relaxed">
            This self-contained demo uses the same Three.js firework renderer as ShowCrafter's
            preview. Use the playback control to watch its cue sequence.
          </p>
          <Doodle name="play" width={130} className="absolute top-[-6px] right-0 hidden lg:block" />
        </Reveal>

        <Reveal delay={0.12} className="relative">
          <Star4 size={22} className="absolute -top-3.5 -left-2 z-[3]" />
          <ShowPreviewPanel height={520} />
        </Reveal>

        <Reveal className="mt-16 flex flex-wrap items-end justify-between gap-4">
          <h3 className="text-on-surface m-0 text-2xl font-bold tracking-[-0.02em]">
            Continue through the planning flow
          </h3>
          <Link
            href="/features"
            className="text-on-surface inline-flex items-center gap-2 text-sm font-medium hover:underline"
          >
            Explore every feature <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </Reveal>

        <Reveal delay={0.08} className="mt-5 grid grid-cols-2 gap-3 sm:gap-[18px] lg:grid-cols-4">
          {WORKFLOW_LINKS.map((item) => (
            <ShowCard key={item.title} {...item} />
          ))}
        </Reveal>
      </Container>
    </section>
  );
}
