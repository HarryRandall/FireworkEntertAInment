'use client';

/**
 * ShowTemplatePreview — clickable template card rendered on the
 * `/library` route. Hovering / focusing the card drives the inline
 * TemplateReplayPreview animation via the `isCardHovered` prop.
 */
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { Clock, Sparkles } from 'lucide-react';
import { CardBorderTrace } from '@/app/components/app/CardBorderTrace';
import { TemplateReplayPreview } from '@/app/components/app/TemplateReplayPreview';
import { Card } from '@/app/components/ui/Card';
import { formatDuration } from '@/lib/show-domain';
import { buildVisualPalette } from '@/lib/show-summary';
import type { FireworkSpecification } from '@/lib/show-domain';
import type { ShowTemplate } from '@/lib/admin.types';

export function ShowTemplatePreview({
  template,
  specifications,
}: {
  template: ShowTemplate;
  specifications: FireworkSpecification[];
}) {
  const [isHovered, setIsHovered] = useState(false);
  const palette = buildVisualPalette(
    [template.id, template.title, template.theme, template.description].filter(Boolean).join(':'),
  );
  const accentStyle = {
    '--template-accent-start': palette.hex[0],
    '--template-accent-middle': palette.hex[1],
    '--template-accent-end': palette.hex[2],
  } as CSSProperties;

  return (
    <Link
      href={`/library/${template.slug}`}
      prefetch
      className="group focus-visible:ring-primary/45 focus-visible:ring-offset-background relative block h-full touch-manipulation rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      aria-label={`Open template: ${template.title}`}
      style={accentStyle}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
    >
      <Card
        elevation="low"
        radius="md"
        hoverable
        className="relative flex h-full flex-col overflow-hidden p-0 transition-shadow duration-200 group-hover:shadow-[0_18px_42px_-32px_rgba(0,0,0,0.55)]"
      >
        <TemplateReplayPreview
          template={template}
          specifications={specifications}
          isCardHovered={isHovered}
        />
        <div className="-mt-px h-[5px] bg-[linear-gradient(90deg,var(--template-accent-start),var(--template-accent-middle),var(--template-accent-end))]" />
        <div className="relative -mt-px grid flex-1 grid-cols-[minmax(0,1fr)_7.25rem] gap-4 overflow-hidden p-4">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-0 h-32 overflow-hidden"
          >
            <span className="absolute inset-x-0 -top-2 h-full origin-top -translate-y-6 scale-y-50 bg-[linear-gradient(90deg,var(--template-accent-start),var(--template-accent-middle),var(--template-accent-end))] [mask-image:linear-gradient(to_bottom,black_0%,rgba(0,0,0,0.62)_30%,rgba(0,0,0,0.2)_62%,transparent_100%)] opacity-0 blur-lg transition-all duration-[1800ms] [transition-timing-function:cubic-bezier(.16,1,.3,1)] group-hover:translate-y-0 group-hover:scale-y-100 group-hover:opacity-40 group-focus-visible:translate-y-0 group-focus-visible:scale-y-100 group-focus-visible:opacity-40 motion-reduce:transition-none" />
          </div>
          <div className="relative z-10 flex min-w-0 flex-col gap-4">
            <div>
              <h2 className="text-on-surface group-hover:text-primary line-clamp-1 text-base font-semibold transition-colors">
                {template.title}
              </h2>
              <p className="text-on-surface-variant mt-1 line-clamp-2 text-sm leading-5">
                {template.theme}
              </p>
            </div>
            <div className="mt-auto flex flex-wrap gap-1.5">
              {template.moodTags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-md border border-[color:var(--color-border-subtle)] bg-[color-mix(in_srgb,var(--template-accent-middle)_8%,transparent)] px-2 py-0.5 text-xs font-medium text-[color:var(--color-content-emphasis)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="relative z-10 flex flex-col items-end justify-between text-right text-xs text-[color:var(--color-content-subtle)]">
            <div className="space-y-1.5">
              <span className="inline-flex items-center justify-end gap-1">
                <Clock size={14} />
                <span className="font-mono tabular-nums">
                  {formatDuration(template.durationSeconds)}
                </span>
              </span>
              <span className="inline-flex items-center justify-end gap-1">
                <Sparkles size={14} />
                <span>{template.effectsCount} effects</span>
              </span>
            </div>
          </div>
          <div className="pointer-events-none absolute top-0 right-[1px] bottom-[2px] left-[2px] z-30">
            <CardBorderTrace
              active={isHovered}
              radius={10}
              colors={[palette.hex[0], palette.hex[1], palette.hex[2]]}
            />
          </div>
        </div>
      </Card>
    </Link>
  );
}
