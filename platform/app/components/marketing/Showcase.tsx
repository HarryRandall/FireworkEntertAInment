/**
 * Showcase — "see it live" section. A full-width night-sky panel with the
 * interactive firework canvas, followed by a small gallery of community
 * shows a visitor can clone and customise.
 */
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Container } from '@/app/components/ui/Container';
import { Reveal } from './Reveal';
import { Doodle, Eyebrow, ShowCard, Star4 } from './landing/decor';
import { ShowPreviewPanel } from './landing/ShowPreviewPanel';

const GALLERY = [
  {
    title: 'Bohemian Rhapsody',
    theme: 'Gold finale · large yard',
    palette: ['#efb93f', '#fb7185', '#8f7be8'],
    likes: 1280,
    budget: '$742',
  },
  {
    title: 'Midnight City',
    theme: 'Cool blues · lakeside',
    palette: ['#38bdf8', '#8f7be8', '#15bd8b'],
    likes: 864,
    budget: '$520',
  },
  {
    title: 'Sweet Caroline',
    theme: 'Warm rose · backyard',
    palette: ['#fb7185', '#efb93f', '#8f7be8'],
    likes: 1530,
    budget: '$610',
  },
  {
    title: 'Mr Brightside',
    theme: 'Violet strobes · rooftop',
    palette: ['#8f7be8', '#38bdf8', '#fb7185'],
    likes: 998,
    budget: '$480',
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
            Every cue, mapped to the music and a real product. This is a live preview, rendered by
            the same engine as the editor: drag to look around.
          </p>
          <Doodle name="play" width={130} className="absolute top-[-6px] right-0 hidden lg:block" />
        </Reveal>

        <Reveal delay={0.12} className="relative">
          <Star4 size={22} style={{ position: 'absolute', top: -14, left: -8, zIndex: 3 }} />
          <ShowPreviewPanel height={520} />
        </Reveal>

        <Reveal className="mt-16 flex flex-wrap items-end justify-between gap-4">
          <h3 className="text-on-surface m-0 text-2xl font-bold tracking-[-0.02em]">
            Or remix a community show
          </h3>
          <Link
            href="/library"
            className="text-on-surface inline-flex items-center gap-2 text-sm font-medium hover:underline"
          >
            Browse the gallery <ArrowRight size={16} />
          </Link>
        </Reveal>

        <Reveal delay={0.08} className="mt-5 grid grid-cols-2 gap-3 sm:gap-[18px] lg:grid-cols-4">
          {GALLERY.map((g) => (
            <ShowCard key={g.title} {...g} action="Clone & customise" href="/library" />
          ))}
        </Reveal>
      </Container>
    </section>
  );
}
