/** The Library browses proven templates and saved staff parts without changing the current draft on hover. */
'use client';
import { useMemo, useState, type Dispatch } from 'react';
import { Dialog } from 'radix-ui';
import type { Design } from '@showcrafter/fireworks';
import {
  applyLibrary,
  libraryEntries,
  type LibraryEntry,
  type SavedPart,
} from '@/lib/studio/library';
import type { StudioEdit } from '@/lib/studio/document';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Modal } from '@/ui/kit/overlays';
import { HoverPreview } from './hover-preview';
import { LibrarySaveForm } from './library-save-form';

const SECTIONS = [
  ['fireworks', 'Fireworks'],
  ['stars', 'Star groups'],
  ['trails', 'Trails'],
  ['effects', 'Effects'],
  ['tails', 'Launch tails'],
  ['saved', 'Saved'],
] as const;
/** Shows searchable sections, replacement confirmation and staff-part persistence. */
export function StudioLibrary({
  document,
  selected,
  editable,
  parts,
  onSaved,
  dispatch,
}: {
  document: Design;
  selected: string;
  editable: boolean;
  parts: SavedPart[];
  onSaved: (part: SavedPart) => void;
  dispatch: Dispatch<StudioEdit>;
}) {
  const [category, setCategory] = useState('fireworks');
  const [query, setQuery] = useState('');
  const [failure, setFailure] = useState('');
  const entries = useMemo(() => libraryEntries(), []);
  const all = [...parts.map((part) => ({ ...part, saved: true })), ...entries];
  const visible = all.filter(
    (entry) =>
      (category === 'saved' ? entry.saved === true : entry.category === category) &&
      entry.name.toLowerCase().includes(query.toLowerCase()),
  );
  const apply = (entry: LibraryEntry) => {
    if (!editable) return;
    const result = applyLibrary(document, selected, entry);
    if (result.kind === 'invalid') {
      setFailure(result.message);
      return;
    }
    setFailure('');
    dispatch({ type: 'commit' });
    dispatch({ type: 'replace', document: result.document });
  };
  return (
    <section aria-label="Library" className="grid gap-3">
      <div role="group" aria-label="Library sections" className="flex flex-wrap gap-1">
        {SECTIONS.map(([key, label]) => (
          <Button
            size="sm"
            variant={category === key ? 'secondary' : 'outline'}
            key={key}
            aria-pressed={category === key}
            onClick={() => {
              setCategory(key);
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <Input
        aria-label="Search library"
        placeholder="Search library"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
      />
      <p className="text-muted-foreground text-xs">
        Fireworks replace after a check. Star groups add to the current break. Other parts apply to
        the selected group or launch.
      </p>
      <LibrarySaveForm
        document={document}
        selected={selected}
        editable={editable}
        onSaved={onSaved}
      />
      {failure !== '' && <p role="alert">{failure}</p>}
      {visible.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No library items match this section and search.
        </p>
      )}
      <div className="sc-studio-library-items grid gap-2">
        {visible.map((entry) => (
          <LibraryChoice
            key={`${entry.category}:${entry.id}`}
            entry={entry}
            document={document}
            selected={selected}
            editable={editable}
            apply={apply}
          />
        ))}
      </div>
    </section>
  );
}
function LibraryChoice({
  entry,
  document,
  selected,
  editable,
  apply,
}: {
  entry: LibraryEntry;
  document: Design;
  selected: string;
  editable: boolean;
  apply: (entry: LibraryEntry) => void;
}) {
  const preview = useMemo(
    () => applyLibrary(document, selected, entry),
    [document, selected, entry],
  );
  const button = (
    <Button
      className="h-auto w-full justify-start whitespace-normal"
      variant="outline"
      disabled={!editable || preview.kind === 'invalid'}
      onClick={
        entry.category === 'fireworks'
          ? undefined
          : () => {
              apply(entry);
            }
      }
    >
      <span className="min-w-0 text-left break-words">
        {entry.name}
        <small className="text-muted-foreground block">
          {entry.saved === true ? 'Saved by staff' : entry.category}
        </small>
      </span>
    </Button>
  );
  const trigger = (
    <HoverPreview
      document={preview.kind === 'edited' ? preview.document : null}
      name={entry.name}
      address={selected}
      climb={entry.category === 'tails'}
    >
      {button}
    </HoverPreview>
  );
  if (entry.category !== 'fireworks') return trigger;
  return (
    <Modal
      title={`Start from ${entry.name}?`}
      description="This replaces the entire current design. You can undo afterwards."
      trigger={trigger}
    >
      <div className="flex gap-2">
        <Dialog.Close asChild>
          <Button variant="outline">Cancel</Button>
        </Dialog.Close>
        <Dialog.Close asChild>
          <Button
            onClick={() => {
              apply(entry);
            }}
          >
            Replace firework
          </Button>
        </Dialog.Close>
      </div>
    </Modal>
  );
}
