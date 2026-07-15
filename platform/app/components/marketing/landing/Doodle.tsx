/**
 * Server-rendered doodle illustrations. The SVG source files live in public,
 * but are inlined here so their exported fills can be controlled with CSS vars.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

type DoodleName = 'fire' | 'burst' | 'play' | 'retry' | 'fountain' | 'willow';
type DoodleColourKey =
  | 'ink'
  | 'inkSoft'
  | 'inkMuted'
  | 'inkHighlight'
  | 'paper'
  | 'white'
  | 'blue'
  | 'blueBright'
  | 'green'
  | 'teal'
  | 'red'
  | 'rose'
  | 'gold'
  | 'violet'
  | 'violetSoft';
type DoodleColours = Partial<Record<DoodleColourKey, string>>;

const DOODLE_COLOUR_VARS: Record<DoodleColourKey, `--lp-doodle-${string}`> = {
  ink: '--lp-doodle-ink',
  inkSoft: '--lp-doodle-ink-soft',
  inkMuted: '--lp-doodle-ink-muted',
  inkHighlight: '--lp-doodle-ink-highlight',
  paper: '--lp-doodle-paper',
  white: '--lp-doodle-white',
  blue: '--lp-doodle-blue',
  blueBright: '--lp-doodle-blue-bright',
  green: '--lp-doodle-green',
  teal: '--lp-doodle-teal',
  red: '--lp-doodle-red',
  rose: '--lp-doodle-rose',
  gold: '--lp-doodle-gold',
  violet: '--lp-doodle-violet',
  violetSoft: '--lp-doodle-violet-soft',
};

const DOODLE_FILL_TOKENS: Record<string, string> = {
  '#0F100F': 'var(--lp-doodle-ink)',
  '#1F1D1E': 'var(--lp-doodle-ink)',
  '#050506': 'var(--lp-doodle-ink)',
  '#272626': 'var(--lp-doodle-ink)',
  '#37403C': 'var(--lp-doodle-ink)',
  '#454242': 'var(--lp-doodle-ink-soft)',
  '#4C4B4C': 'var(--lp-doodle-ink-soft)',
  '#5A5959': 'var(--lp-doodle-ink-soft)',
  '#AFABAA': 'var(--lp-doodle-ink-muted)',
  '#EDECEE': 'var(--lp-doodle-ink-highlight)',
  '#EFEEEE': 'var(--lp-doodle-ink-highlight)',
  '#FEFDFC': 'var(--lp-doodle-paper)',
  WHITE: 'var(--lp-doodle-white)',

  '#3061B7': 'var(--lp-doodle-blue)',
  '#296DE7': 'var(--lp-doodle-blue)',
  '#38A8EB': 'var(--lp-doodle-blue-bright)',
  '#5CBCF8': 'var(--lp-doodle-blue-bright)',

  '#7CBD7A': 'var(--lp-doodle-green)',
  '#4AA289': 'var(--lp-doodle-teal)',
  '#12AE7C': 'var(--lp-doodle-teal)',
  '#0BC087': 'var(--lp-doodle-teal)',
  '#329C86': 'var(--lp-doodle-teal)',

  '#C74F4A': 'var(--lp-doodle-red)',
  '#D63931': 'var(--lp-doodle-red)',
  '#EB5556': 'var(--lp-doodle-red)',
  '#A6392F': 'var(--lp-doodle-red)',
  '#711515': 'var(--lp-doodle-red)',

  '#E5559D': 'var(--lp-doodle-rose)',
  '#E6C3C2': 'var(--lp-doodle-rose)',

  '#B68F66': 'var(--lp-doodle-gold)',
  '#E9BB89': 'var(--lp-doodle-gold)',
  '#F3C081': 'var(--lp-doodle-gold)',
  '#E2C275': 'var(--lp-doodle-gold)',
  '#C1A878': 'var(--lp-doodle-gold)',

  '#6253A0': 'var(--lp-doodle-violet)',
  '#9F60D8': 'var(--lp-doodle-violet)',
  '#AE7BE4': 'var(--lp-doodle-violet)',
  '#9070D5': 'var(--lp-doodle-violet)',
  '#BAADDF': 'var(--lp-doodle-violet-soft)',
};

const DOODLE_DIR = join(process.cwd(), 'public/images/landing/doodles');

function normaliseFill(fill: string) {
  return fill.toLowerCase() === 'white' ? 'WHITE' : fill.toUpperCase();
}

function inlineDoodleSvg(name: DoodleName) {
  const source = readFileSync(join(DOODLE_DIR, `${name}.svg`), 'utf8');
  const tokenised = source
    .replace(/<\?xml[^>]*>\s*/g, '')
    .replace(/\s(?:width|height)="[^"]*"/g, '')
    .replace(/\bfill="([^"]+)"/g, (_match, fill: string) => {
      return `fill="${DOODLE_FILL_TOKENS[normaliseFill(fill)] ?? fill}"`;
    });

  return tokenised.trim().replace(/<svg\b([^>]*)>/, (_match, attrs: string) => {
    const fill = /\sfill=/.test(attrs) ? '' : ' fill="var(--lp-doodle-ink)"';
    return `<svg${attrs}${fill} class="lp-doodle-svg" aria-hidden="true" focusable="false">`;
  });
}

const DOODLE_MARKUP: Record<DoodleName, string> = {
  fire: inlineDoodleSvg('fire'),
  burst: inlineDoodleSvg('burst'),
  play: inlineDoodleSvg('play'),
  retry: inlineDoodleSvg('retry'),
  fountain: inlineDoodleSvg('fountain'),
  willow: inlineDoodleSvg('willow'),
};

function getDoodleColourStyle(colours?: DoodleColours) {
  if (!colours) {
    return undefined;
  }

  const colourStyle: Record<string, string> = {};
  for (const [key, value] of Object.entries(colours) as [DoodleColourKey, string][]) {
    if (value) {
      colourStyle[DOODLE_COLOUR_VARS[key]] = value;
    }
  }

  return colourStyle as CSSProperties;
}

export function Doodle({
  name,
  width,
  bob = false,
  className,
  style,
  colours,
}: {
  name: DoodleName;
  width: number;
  bob?: boolean;
  priority?: boolean;
  className?: string;
  style?: CSSProperties;
  colours?: DoodleColours;
}) {
  const colourStyle = getDoodleColourStyle(colours);
  return (
    <span
      className={cn(
        'lp-doodle relative inline-block',
        `lp-doodle-${name}`,
        bob && 'lp-doodle-bob',
        className,
      )}
      aria-hidden="true"
      style={{ width, ...colourStyle, ...style }}
      dangerouslySetInnerHTML={{ __html: DOODLE_MARKUP[name] }}
    />
  );
}
