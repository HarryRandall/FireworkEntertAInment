'use client';

import type { CSSProperties } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

type GeneratedAvatarProps = {
  name?: string | null;
  email?: string | null;
  imageUrl?: string | null;
  initials?: string | null;
  alt?: string;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  fallbackClassName?: string;
};

type AvatarStyle = CSSProperties & {
  '--avatar-angle': string;
  '--avatar-from': string;
  '--avatar-to': string;
  '--avatar-via': string;
  '--avatar-depth': string;
  '--avatar-rim': string;
};

const AVATAR_HUE_PALETTES = [
  [342, 286, 225],
  [58, 342, 256],
  [28, 330, 212],
  [78, 156, 216],
  [188, 232, 280],
  [126, 172, 224],
  [300, 344, 24],
  [44, 88, 156],
  [220, 270, 326],
  [14, 52, 312],
  [166, 210, 264],
  [334, 20, 62],
  [96, 150, 196],
  [248, 198, 128],
  [358, 48, 226],
  [282, 330, 52],
  [142, 188, 236],
  [210, 312, 8],
  [54, 104, 184],
  [308, 152, 205],
  [24, 72, 132],
  [240, 172, 42],
  [326, 246, 166],
  [64, 18, 286],
  [114, 48, 332],
  [270, 174, 124],
  [52, 330, 252],
  [198, 88, 322],
  [38, 14, 210],
  [294, 234, 54],
  [150, 198, 318],
  [74, 126, 272],
  [12, 278, 190],
  [228, 34, 78],
  [344, 204, 116],
  [86, 306, 22],
  [250, 346, 62],
  [180, 134, 310],
  [16, 192, 252],
  [62, 116, 340],
] as const;

function hashIdentity(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function normaliseIdentity(name?: string | null, email?: string | null) {
  return `${name ?? ''}|${email ?? ''}`.trim().toLowerCase() || 'showcrafter';
}

function firstGlyph(value: string) {
  return Array.from(value.trim())[0] ?? '';
}

function fallbackInitials(value: string) {
  return Array.from(value.trim()).slice(0, 2).join('').toUpperCase() || 'SC';
}

function channelFor(value: string | undefined, fallback: number) {
  if (!value) return fallback;

  const code = value.toUpperCase().codePointAt(0) ?? fallback;
  if (code >= 65 && code <= 90) return code - 65;
  if (code >= 48 && code <= 57) return 26 + code - 48;
  return code % 36;
}

function getPaletteIndex(initials: string, hash: number) {
  const [firstGlyphValue, secondGlyphValue] = Array.from(initials);
  const first = channelFor(firstGlyphValue, 18);
  const second = channelFor(secondGlyphValue, first);
  const identityOffset = (hash % 11) * 7;

  return (
    (first * 17 + second * 31 + (first + 1) * (second + 3) + identityOffset) %
    AVATAR_HUE_PALETTES.length
  );
}

function oklchColour(hue: number, lightness: number, chroma: number) {
  return `oklch(${lightness} ${chroma} ${hue})`;
}

export function generatedAvatarInitials(
  name?: string | null,
  email?: string | null,
  fallback = 'SC',
) {
  const source = (name?.trim() || email?.split('@')[0] || fallback).trim();
  const words = source
    .replace(/@.*$/, '')
    .replace(/[._-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 2) {
    return `${firstGlyph(words[0])}${firstGlyph(words[words.length - 1])}`.toUpperCase();
  }

  if (words.length === 1) {
    return fallbackInitials(words[0]);
  }

  return fallbackInitials(fallback);
}

function getAvatarStyle(
  displayInitials: string,
  name?: string | null,
  email?: string | null,
): AvatarStyle {
  const hash = hashIdentity(normaliseIdentity(name, email));
  const [fromHue, viaHue, toHue] = AVATAR_HUE_PALETTES[getPaletteIndex(displayInitials, hash)];

  return {
    '--avatar-angle': `${115 + (hash % 130)}deg`,
    '--avatar-depth': 'rgb(15 23 42 / 0.22)',
    '--avatar-from': oklchColour(fromHue, 0.5, 0.155),
    '--avatar-rim': 'rgb(255 255 255 / 0.28)',
    '--avatar-to': oklchColour(toHue, 0.45, 0.15),
    '--avatar-via': oklchColour(viaHue, 0.42, 0.135),
    backgroundImage:
      'linear-gradient(var(--avatar-angle), var(--avatar-from), var(--avatar-via) 52%, var(--avatar-to))',
    boxShadow: 'inset 0 0 0 1px var(--avatar-rim), inset 0 -10px 18px var(--avatar-depth)',
  };
}

export function GeneratedAvatar({
  name,
  email,
  imageUrl,
  initials,
  alt,
  size = 'default',
  className,
  fallbackClassName,
}: GeneratedAvatarProps) {
  const displayInitials =
    initials?.trim().slice(0, 2).toUpperCase() || generatedAvatarInitials(name, email);
  const label = alt ?? `${name || email || 'User'} profile picture`;

  return (
    <Avatar
      size={size}
      className={cn(
        'bg-white shadow-[0_1px_2px_rgb(15_23_42_/_0.16)] ring-1 ring-slate-950/10 after:hidden dark:bg-slate-950 dark:ring-white/15',
        className,
      )}
      role="img"
      aria-label={label}
    >
      {imageUrl ? <AvatarImage src={imageUrl} alt="" /> : null}
      <AvatarFallback
        aria-hidden="true"
        delayMs={imageUrl ? 300 : 0}
        className={cn(
          'relative isolate overflow-hidden text-[11px] font-semibold text-white group-data-[size=lg]/avatar:text-sm group-data-[size=sm]/avatar:text-[10px]',
          fallbackClassName,
        )}
        style={getAvatarStyle(displayInitials, name, email)}
      >
        <span className="relative z-10 drop-shadow-[0_1px_1px_rgb(0_0_0_/_0.48)]">
          {displayInitials}
        </span>
      </AvatarFallback>
    </Avatar>
  );
}
