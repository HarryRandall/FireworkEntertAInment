'use client';

/**
 * ShowTemplatePreview — clickable template card rendered on the
 * `/library` route. Hovering / focusing the card drives the inline
 * TemplateReplayPreview animation via the `isCardHovered` prop.
 */
import Link from 'next/link';
import { useState } from 'react';
import { Clock, Heart, Sparkles, Wallet } from 'lucide-react';
import { TemplateReplayPreview } from '@/app/components/app/TemplateReplayPreview';
import { Badge } from '@/app/components/ui/Badge';
import { Card } from '@/app/components/ui/Card';
import { formatBudget, formatDuration } from '@/lib/show-domain';
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

  return (
    <Link
      href={`/library/${template.slug}`}
      prefetch
      className="group focus-visible:ring-primary/45 focus-visible:ring-offset-background block h-full touch-manipulation rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      aria-label={`Open template: ${template.title}`}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
    >
      <Card
        elevation="low"
        radius="md"
        hoverable
        className="flex h-full flex-col overflow-hidden p-0"
      >
        <TemplateReplayPreview
          template={template}
          specifications={specifications}
          isCardHovered={isHovered}
        />
        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-on-surface group-hover:text-primary text-xl font-bold transition-colors">
                {template.title}
              </h2>
              <p className="text-on-surface-variant mt-1 text-sm">{template.theme}</p>
            </div>
            <Sparkles className="text-primary shrink-0" size={19} />
          </div>
          <div className="text-on-surface-variant mt-5 flex flex-wrap gap-3 text-sm">
            <span className="inline-flex items-center gap-1">
              <Heart size={15} />
              {template.likeCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock size={15} />
              {formatDuration(template.durationSeconds)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Wallet size={15} />
              {formatBudget(template.totalCents)}
            </span>
            <span>{template.effectsCount} effects</span>
          </div>
          <div className="mt-auto flex flex-wrap gap-2 pt-4">
            {template.moodTags.slice(0, 3).map((tag) => (
              <Badge key={tag} tone="neutral">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </Card>
    </Link>
  );
}
