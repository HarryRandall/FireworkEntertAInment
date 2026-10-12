/** Built-in and saved parts apply to the selected star group; saving a part is separate from saving the record. */
'use client';
import { useState, useTransition } from 'react';
import { Search, Trash2 } from 'lucide-react';
import type { Design } from '@showcrafter/renderer';
import {
  LIBRARY_CATEGORIES,
  applyLibrary,
  canSavePart,
  libraryEntries,
  partCategorySchema,
  partEnvelope,
  type LibraryEntry,
  type PartCategory,
  type SavedPart,
} from '@/lib/renderer-editor/library';
import {
  deleteEditorLibraryPart,
  saveEditorLibraryPart,
} from '@/lib/admin/editor-library-actions.server';
import { Button } from '@/ui/patterns/Button';
import { Field, FieldLabel } from '@/ui/patterns/Field';
import { Input } from '@/ui/patterns/Input';
import { SelectField } from '@/ui/patterns/SelectField';
import { InlineAlert } from '@/ui/patterns/Feedback';
import { toast } from '@/ui/patterns/toast';
import { cn } from '@/lib/utils';
import { HoverPreview } from './hover-preview';
import { InspectorSection } from './inspector-controls';

const SAVE_LABELS: Record<PartCategory, string> = {
  stars: 'This star group',
  trails: "This group's trail",
  effects: "This group's effects",
  tails: 'The rising tail',
};

/** Lists parts by category and copies one into the design as a single undoable edit. */
export function LibraryPanel({
  document,
  selected,
  disabled,
  initialParts,
  onChange,
}: {
  document: Design;
  selected: string;
  disabled: boolean;
  initialParts: readonly SavedPart[];
  onChange: (document: Design) => void;
}) {
  const [parts, setParts] = useState<SavedPart[]>(() => [...initialParts]);
  const [category, setCategory] = useState<LibraryEntry['category']>('stars');
  const [query, setQuery] = useState('');
  const [failure, setFailure] = useState('');
  const entries = libraryEntries(parts).filter(
    (entry) =>
      entry.category === category && entry.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const apply = (entry: LibraryEntry) => {
    const result = applyLibrary(document, selected, entry);
    if (result.kind === 'invalid') {
      setFailure(result.message);
      return;
    }
    setFailure('');
    onChange(result.document);
  };
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Library categories" className="flex flex-wrap gap-1">
        {LIBRARY_CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={category === item.id}
            onClick={() => setCategory(item.id)}
            className={cn(
              'focus-visible:ring-ring rounded-md border px-2 py-1 text-xs outline-none focus-visible:ring-2',
              category === item.id
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <Input
        aria-label="Search the library"
        placeholder="Search"
        iconLeft={<Search size={14} />}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {failure && (
        <p role="alert" className="text-status-danger text-xs">
          {failure}
        </p>
      )}
      <ul className="max-h-80 space-y-1 overflow-y-auto" aria-label="Library parts">
        {entries.length === 0 && (
          <li className="text-muted-foreground text-xs">Nothing matches in this category.</li>
        )}
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center gap-1">
            <HoverPreview document={entry.design ?? null} name={entry.name}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => apply(entry)}
                className="hover:bg-muted focus-visible:ring-ring min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-xs outline-none focus-visible:ring-2 disabled:opacity-50"
              >
                {entry.name}
                {entry.saved && <span className="text-muted-foreground ml-1">(saved)</span>}
              </button>
            </HoverPreview>
            {entry.saved && (
              <DeletePart
                entry={entry}
                disabled={disabled}
                onDeleted={() => setParts((current) => current.filter((p) => p.id !== entry.id))}
              />
            )}
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-xs">
        {category === 'fireworks'
          ? 'A whole firework replaces the current design.'
          : category === 'stars'
            ? 'Star groups are added to the selected break.'
            : 'Parts replace the matching part of the selected star group.'}
      </p>
      <SavePartForm
        document={document}
        selected={selected}
        disabled={disabled}
        onSaved={(part) => {
          setParts((current) => [part, ...current]);
          setCategory(part.category);
        }}
      />
    </div>
  );
}

function DeletePart({
  entry,
  disabled,
  onDeleted,
}: {
  entry: LibraryEntry;
  disabled: boolean;
  onDeleted: () => void;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Remove ${entry.name} from the library`}
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteEditorLibraryPart({ id: entry.id }).catch(() => ({
            ok: false as const,
            error: 'The part could not be removed. Try again.',
          }));
          if (result.ok) {
            onDeleted();
            toast.success('Part removed');
          } else toast.error(result.error);
        })
      }
    >
      <Trash2 size={14} />
    </Button>
  );
}

function SavePartForm({
  document,
  selected,
  disabled,
  onSaved,
}: {
  document: Design;
  selected: string;
  disabled: boolean;
  onSaved: (part: SavedPart) => void;
}) {
  const [category, setCategory] = useState<PartCategory>('stars');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const savable = canSavePart(document, selected, category);
  return (
    <InspectorSection title="Save to library" open={false}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!savable || name.trim() === '') return;
          const design = partEnvelope(document, selected);
          startTransition(async () => {
            const result = await saveEditorLibraryPart({
              name: name.trim(),
              category,
              design,
            }).catch(() => ({
              ok: false as const,
              error: 'The part could not be saved. Try again.',
            }));
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setError('');
            setName('');
            onSaved(result.value);
            toast.success('Saved to the library');
          });
        }}
      >
        <Field>
          <FieldLabel>Part</FieldLabel>
          <SelectField
            ariaLabel="Part to save"
            value={category}
            onChange={(value) => {
              const parsed = partCategorySchema.safeParse(value);
              if (parsed.success) setCategory(parsed.data);
            }}
            options={partCategorySchema.options.map((value) => ({
              value,
              label: SAVE_LABELS[value],
            }))}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="library-part-name">Name</FieldLabel>
          <Input
            id="library-part-name"
            value={name}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        {!savable && (
          <p className="text-muted-foreground text-xs">
            The selected star group has nothing to save for this part.
          </p>
        )}
        {error && (
          <InlineAlert tone="danger" title="Not saved">
            {error}
          </InlineAlert>
        )}
        <Button
          type="submit"
          variant="secondary"
          loading={pending}
          disabled={disabled || pending || !savable || name.trim() === ''}
        >
          Save part
        </Button>
        <p className="text-muted-foreground text-xs">
          Saved parts are shared with every catalogue editor.
        </p>
      </form>
    </InspectorSection>
  );
}
