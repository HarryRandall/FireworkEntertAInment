/** Admin prompt control page for OpenRouter prompt families and generation mode. */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { Boxes, RotateCcw, Save, Sparkles, WandSparkles } from 'lucide-react';
import { updatePromptConfigAction } from '@/app/actions/admin-prompts';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Field, FieldLabel } from '@/app/components/ui/Field';
import { Skeleton } from '@/app/components/ui/Feedback';
import { Textarea } from '@/app/components/ui/Input';
import { getAdminPromptControlData } from '@/lib/admin.server';
import { type GenerationSetting, type PromptConfig } from '@/lib/prompt-configs';
import { cn } from '@/lib/utils';
import { GenerationModeControl } from './GenerationModeControl';
import { ProductCatalogueFieldsControl } from './ProductCatalogueFieldsControl';

type PromptTabKey = 'show_prompt' | 'product_context' | 'video_prompt';

type PageProps = {
  searchParams: Promise<{ tab?: string; prompt?: string }>;
};

const PROMPT_TABS: Array<{
  key: PromptTabKey;
  label: string;
}> = [
  {
    key: 'show_prompt',
    label: 'Show prompt',
  },
  {
    key: 'product_context',
    label: 'Product context',
  },
  {
    key: 'video_prompt',
    label: 'Video prompt',
  },
];

const STATIC_SECONDARY_BUTTON_CLASS =
  '!transition-none hover:!border-border hover:!bg-background hover:!text-foreground hover:!ring-0 focus:!border-border focus:!bg-background focus:!text-foreground focus:!ring-0 active:!border-border active:!bg-background active:!text-foreground active:!ring-0';

const STATIC_PRIMARY_BUTTON_CLASS =
  '!transition-none hover:!border-primary hover:!bg-primary hover:!text-primary-foreground hover:!ring-0 focus:!border-primary focus:!bg-primary focus:!text-primary-foreground focus:!ring-0 active:!border-primary active:!bg-primary active:!text-primary-foreground active:!ring-0';

const PROMPT_TEXTAREA_CLASS = 'min-h-0 flex-1 resize-none font-mono text-xs leading-relaxed';

function promptByKey(configs: PromptConfig[], key: PromptConfig['key']) {
  return configs.find((config) => config.key === key) ?? null;
}

function activeTabKey(tab: string | undefined, prompt: string | undefined): PromptTabKey {
  if (tab === 'show_prompt' || tab === 'product_context' || tab === 'video_prompt') return tab;
  if (prompt === 'firework_video_reconstruction') return 'video_prompt';
  if (prompt === 'show_cue_generation') return 'show_prompt';
  return 'show_prompt';
}

export default async function AdminPromptsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const activeKey = activeTabKey(params.tab, params.prompt);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 pb-8">
      <Suspense key={activeKey} fallback={<PromptContentSkeleton activeKey={activeKey} />}>
        <AdminPromptsContent activeKey={activeKey} />
      </Suspense>
    </div>
  );
}

async function AdminPromptsContent({ activeKey }: { activeKey: PromptTabKey }) {
  const data = await getAdminPromptControlData();
  if (!data) redirect('/admin');

  const { configs, generationSetting } = data;
  const showPrompt = promptByKey(configs, 'show_cue_generation');
  const videoPrompt = promptByKey(configs, 'firework_video_reconstruction');

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PromptTabs activeKey={activeKey} configs={configs} />
        <GenerationModeControl setting={generationSetting} />
      </div>

      {activeKey === 'show_prompt' && showPrompt ? (
        <PromptEditor
          prompt={showPrompt}
          icon={<Sparkles size={18} />}
          textareaRows={20}
          fieldName="systemPromptText"
          fieldLabel="Show generation system prompt"
          description="Define the system instructions used when the LLM turns a song and creative brief into show cues."
        />
      ) : activeKey === 'product_context' && showPrompt ? (
        <ProductContextEditor prompt={showPrompt} setting={generationSetting} />
      ) : activeKey === 'video_prompt' && videoPrompt ? (
        <PromptEditor
          prompt={videoPrompt}
          icon={<WandSparkles size={18} />}
          textareaRows={20}
          fieldName="systemPromptText"
          fieldLabel="Video reconstruction prompt"
          description="Guide the import worker when it reconstructs firework product metadata from supplier videos."
        />
      ) : (
        <MissingPrompt />
      )}
    </>
  );
}

function PromptTabs({ activeKey, configs }: { activeKey: PromptTabKey; configs: PromptConfig[] }) {
  return (
    <nav
      aria-label="Prompt settings"
      className="border-border bg-card inline-flex flex-wrap gap-1 rounded-lg border p-1"
    >
      {PROMPT_TABS.map((tab) => {
        const active = tab.key === activeKey;
        const isMissing =
          (tab.key === 'show_prompt' || tab.key === 'product_context') &&
          !promptByKey(configs, 'show_cue_generation');
        const isVideoMissing =
          tab.key === 'video_prompt' && !promptByKey(configs, 'firework_video_reconstruction');
        return (
          <Link
            key={tab.key}
            href={`/admin/prompts?tab=${tab.key}`}
            prefetch
            className={cn(
              'focus-visible:ring-ring/50 inline-flex min-h-10 min-w-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-3',
              active
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <span className="truncate">{tab.label}</span>
            {isMissing || isVideoMissing ? <Badge tone="neutral">Missing</Badge> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function PromptContentSkeleton({ activeKey }: { activeKey: PromptTabKey }) {
  const heading =
    activeKey === 'video_prompt'
      ? 'Video reconstruction prompt'
      : activeKey === 'product_context'
        ? 'Product context'
        : 'Show generation system prompt';

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label="Prompt settings"
          className="border-border bg-card inline-flex flex-wrap gap-1 rounded-lg border p-1"
        >
          {PROMPT_TABS.map((tab) => {
            const active = tab.key === activeKey;

            return (
              <Link
                key={tab.key}
                href={`/admin/prompts?tab=${tab.key}`}
                prefetch
                className={cn(
                  'focus-visible:ring-ring/50 inline-flex min-h-10 min-w-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-3',
                  active
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <span className="truncate">{tab.label}</span>
              </Link>
            );
          })}
        </nav>

        <div
          aria-hidden
          className="border-border bg-card inline-flex items-center gap-1 rounded-lg border p-1"
        >
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>

      <Card
        radius="md"
        className="flex min-h-0 flex-1 p-4 pb-5 shadow-xs"
        aria-label="Loading prompt editor"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <Skeleton className="h-11 w-11 shrink-0 rounded-md" />
              <div className="min-w-0">
                <h2 className="text-foreground text-lg font-semibold">{heading}</h2>
                <Skeleton className="mt-2 h-4 w-[min(36rem,70vw)] rounded-md" />
                <Skeleton className="mt-2 h-4 w-[min(28rem,62vw)] rounded-md" />
              </div>
            </div>
            <Skeleton className="mt-0.5 h-6 w-16 shrink-0 rounded-md" />
          </div>

          <Skeleton className="min-h-[416px] flex-1 rounded-md" />

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end sm:pb-1">
            {activeKey === 'product_context' ? (
              <Skeleton className="h-10 w-full rounded-lg sm:w-40" />
            ) : null}
            <Skeleton className="h-10 w-full rounded-lg sm:w-[92px]" />
            <Skeleton className="h-10 w-full rounded-lg sm:w-[82px]" />
          </div>
        </div>
      </Card>
    </>
  );
}

function ProductContextEditor({
  prompt,
  setting,
}: {
  prompt: PromptConfig;
  setting: GenerationSetting;
}) {
  const textareaKey = `${prompt.key}:productContextText:${prompt.updatedAt}`;

  return (
    <Card radius="md" className="flex min-h-0 flex-1 p-4 pb-5 shadow-xs">
      <form action={updatePromptConfigAction} className="flex min-h-0 flex-1 flex-col gap-4">
        <input type="hidden" name="key" value={prompt.key} />

        <PromptCardHeader
          icon={<Boxes size={18} />}
          title="Product context"
          description="Shape how the LLM reads the available fireworks catalogue when it turns a song and creative brief into cue choices."
          isActive={prompt.isActive}
        />

        <Field className="flex min-h-0 min-w-0 flex-1 flex-col space-y-0">
          <FieldLabel htmlFor={`${prompt.key}-productContextText`} className="sr-only">
            Product context
          </FieldLabel>
          <Textarea
            key={textareaKey}
            id={`${prompt.key}-productContextText`}
            name="productContextText"
            rows={20}
            defaultValue={prompt.productContextText ?? ''}
            className={PROMPT_TEXTAREA_CLASS}
          />
        </Field>

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end sm:pb-1">
          <ProductCatalogueFieldsControl initialFields={setting.productCatalogueFields} />
          <Button type="reset" variant="secondary" className={STATIC_SECONDARY_BUTTON_CLASS}>
            <RotateCcw size={16} />
            Reset
          </Button>
          <Button type="submit" className={STATIC_PRIMARY_BUTTON_CLASS}>
            <Save size={16} />
            Save
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PromptEditor({
  prompt,
  icon,
  textareaRows,
  fieldName,
  fieldLabel,
  fieldValue,
  description,
}: {
  prompt: PromptConfig;
  icon: ReactNode;
  textareaRows: number;
  fieldName: 'systemPromptText' | 'productContextText';
  fieldLabel: string;
  fieldValue?: string;
  description: string;
}) {
  const textareaKey = `${prompt.key}:${fieldName}:${prompt.updatedAt}`;
  const textareaValue =
    fieldValue ??
    (fieldName === 'productContextText'
      ? (prompt.productContextText ?? '')
      : prompt.systemPromptText);

  return (
    <Card radius="md" className="flex min-h-0 flex-1 p-4 pb-5">
      <form action={updatePromptConfigAction} className="flex min-h-0 flex-1 flex-col gap-4">
        <input type="hidden" name="key" value={prompt.key} />
        <PromptCardHeader
          icon={icon}
          title={fieldLabel}
          description={description}
          isActive={prompt.isActive}
        />

        <Field className="flex min-h-0 flex-1 flex-col space-y-0">
          <FieldLabel htmlFor={`${prompt.key}-${fieldName}`} className="sr-only">
            {fieldLabel}
          </FieldLabel>
          <Textarea
            key={textareaKey}
            id={`${prompt.key}-${fieldName}`}
            name={fieldName}
            rows={textareaRows}
            defaultValue={textareaValue}
            className={PROMPT_TEXTAREA_CLASS}
            required={fieldName === 'systemPromptText'}
          />
        </Field>

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end sm:pb-1">
          <Button type="reset" variant="secondary" className={STATIC_SECONDARY_BUTTON_CLASS}>
            <RotateCcw size={16} />
            Reset
          </Button>
          <Button type="submit" className={STATIC_PRIMARY_BUTTON_CLASS}>
            <Save size={16} />
            Save
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PromptCardHeader({
  icon,
  title,
  description,
  isActive,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  isActive: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="border-border bg-muted text-foreground inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-foreground text-lg font-semibold">{title}</h2>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm">{description}</p>
        </div>
      </div>
      <Badge tone={isActive ? 'success' : 'neutral'} solid className="mt-0.5 shrink-0">
        {isActive ? 'Active' : 'Inactive'}
      </Badge>
    </div>
  );
}

function MissingPrompt() {
  return (
    <Card radius="md" className="p-5">
      <h2 className="text-foreground text-lg font-semibold">Missing prompt config</h2>
      <p className="text-muted-foreground mt-2 text-sm">
        Apply the latest Supabase migrations to seed prompt and generation settings.
      </p>
    </Card>
  );
}
