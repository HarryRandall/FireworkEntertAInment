'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Gauge, Sparkles } from 'lucide-react';
import { updateShowGenerationModeAction } from '@/app/actions/admin-prompts';
import { InfoTooltip } from '@/app/components/ui/InfoTooltip';
import { toast } from '@/app/components/ui/toast';
import type { GenerationMode, GenerationSetting } from '@/lib/prompt-configs';
import { cn } from '@/lib/utils';

type ModeOption = {
  value: GenerationMode;
  label: string;
  description: string;
  icon: typeof Gauge;
};

const MODE_OPTIONS: ModeOption[] = [
  {
    value: 'fast',
    label: 'Fast',
    description: 'Uses the deterministic planner for quick cue generation without prompt text.',
    icon: Gauge,
  },
  {
    value: 'llm',
    label: 'LLM',
    description: 'Uses OpenRouter with the show prompt and product context for cue generation.',
    icon: Sparkles,
  },
];

function modeLabel(mode: GenerationMode) {
  return MODE_OPTIONS.find((option) => option.value === mode)?.label ?? mode.toUpperCase();
}

export function GenerationModeControl({ setting }: { setting: GenerationSetting }) {
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState<GenerationMode>(setting.generationMode);
  const [pendingMode, setPendingMode] = useState<GenerationMode | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSelectedMode(setting.generationMode);
  }, [setting.generationMode]);

  function saveMode(nextMode: GenerationMode) {
    if (isPending || pendingMode) return;

    if (nextMode === selectedMode) {
      toast.info(`${modeLabel(nextMode)} mode is already active`);
      return;
    }

    const previousMode = selectedMode;
    setSelectedMode(nextMode);
    setPendingMode(nextMode);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set('generationMode', nextMode);
        const result = await updateShowGenerationModeAction(formData);

        setPendingMode(null);

        if (!result.ok) {
          setSelectedMode(previousMode);
          toast.error(result.error);
          return;
        }

        setSelectedMode(result.generationMode);
        toast.success(`${modeLabel(result.generationMode)} mode saved`, {
          description:
            result.generationMode === 'llm'
              ? 'Cue generation will use the saved prompts.'
              : 'Cue generation will use the fast planner.',
        });
        router.refresh();
      } catch {
        setPendingMode(null);
        setSelectedMode(previousMode);
        toast.error('Could not save generation mode.');
      }
    });
  }

  return (
    <div
      role="radiogroup"
      aria-label="Show generation mode"
      className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] p-1"
    >
      {MODE_OPTIONS.map((option) => {
        const active = option.value === selectedMode;
        const Icon = option.icon;

        return (
          <div
            key={option.value}
            className={cn(
              'inline-flex h-9 min-w-24 cursor-pointer items-center rounded-md text-sm font-semibold transition-colors',
              active
                ? 'bg-[color:var(--color-content-emphasis)] text-[color:var(--color-content-inverted)] shadow-[var(--shadow-card)]'
                : 'text-[color:var(--color-content-default)] hover:bg-[color:var(--color-bg-subtle)] hover:text-[color:var(--color-content-emphasis)]',
            )}
          >
            <button
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${option.label} mode. ${option.description}`}
              aria-busy={option.value === pendingMode || undefined}
              onClick={() => saveMode(option.value)}
              className="inline-flex h-full min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md py-0 pr-1.5 pl-3 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)]"
            >
              <Icon aria-hidden className="h-4 w-4" />
              <span>{option.label}</span>
            </button>
            <InfoTooltip
              text={option.description}
              className={cn(
                'mr-2 h-3.5 w-3.5 shrink-0 border-current bg-transparent text-current hover:border-current hover:text-current [&_span]:text-[7px]',
                active && 'focus-visible:outline-[color:var(--color-content-inverted)]',
              )}
            />
          </div>
        );
      })}
    </div>
  );
}
