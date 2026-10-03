/** A chip's anchored preview shows the current firework with only that choice changed. */
'use client';
import type { ReactElement, ComponentProps } from 'react';
import type { Design } from '@showcrafter/fireworks';
import { Tooltip } from 'radix-ui';
import { StudioPoster } from './studio-poster';

const HOVER_DELAY_MS = 250; // Prototype hover intent delay, milliseconds.
const ANCHOR_GAP_PX = 12; // Prototype arrow gap in CSS pixels.
const EDGE_PADDING_PX = 8; // Keep the card inside the viewport, CSS pixels.
/** Anchors one shared-context looping preview to a mouse or keyboard focused chip. */
export function HoverPreview({
  document,
  name,
  climb = false,
  children,
  address = '',
  ...triggerProps
}: {
  document: Design | null;
  name: string;
  climb?: boolean;
  children: ReactElement;
  address?: string;
} & Omit<ComponentProps<typeof Tooltip.Trigger>, 'children'>) {
  if (!document) return children;
  return (
    <Tooltip.Provider delayDuration={HOVER_DELAY_MS}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild {...triggerProps}>
          {children}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            // Radix copies unlabelled children into its hidden description; keep the canvas mounted once.
            aria-label={`${name}. Preview in the current firework.`}
            className="sc-studio-hover bg-popover text-popover-foreground shadow-card border-border z-50 rounded-lg border p-2"
            side="right"
            sideOffset={ANCHOR_GAP_PX}
            collisionPadding={EDGE_PADDING_PX}
          >
            <StudioPoster document={document} loop climb={climb} address={address} />
            <p className="mt-2 text-sm font-medium">{name}</p>
            <p className="text-muted-foreground text-xs">Preview in the current firework</p>
            <Tooltip.Arrow className="fill-popover" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
