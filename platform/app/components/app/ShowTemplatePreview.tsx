"use client";

import Link from "next/link";
import { useState } from "react";
import { Clock, Heart, Sparkles, Wallet } from "lucide-react";
import { TemplateReplayPreview } from "@/app/components/app/TemplateReplayPreview";
import { Badge } from "@/app/components/ui/Badge";
import { Card } from "@/app/components/ui/Card";
import { formatBudget, formatDuration } from "@/lib/shows";
import type { FireworkSpecification } from "@/lib/shows";
import type { ShowTemplate } from "@/lib/platform.types";

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
      className="group block focus:outline-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
    >
      <Card elevation="low" radius="md" hoverable className="overflow-hidden p-0">
        <TemplateReplayPreview
          template={template}
          specifications={specifications}
          isCardHovered={isHovered}
        />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-on-surface transition-colors group-hover:text-primary">
                {template.title}
              </h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                {template.theme}
              </p>
            </div>
            <Sparkles className="shrink-0 text-primary" size={19} />
          </div>
          <div className="mt-5 flex flex-wrap gap-3 text-sm text-on-surface-variant">
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
          <div className="mt-4 flex flex-wrap gap-2">
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
