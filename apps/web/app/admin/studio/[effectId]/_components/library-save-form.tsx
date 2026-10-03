/** Reusable parts are named and copied into the shared staff library with visible failures. */
'use client';
import { useState } from 'react';
import type { Design } from '@showcrafter/fireworks';
import { partEnvelope, partCategorySchema, type SavedPart } from '@/lib/studio/library';
import { selectedLayer } from '@/lib/studio/layers';
import { saveLibraryPart } from '@/lib/studio/library-save';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Modal } from '@/ui/kit/overlays';

const NAME_MAX_LENGTH = 120; // Characters, renderer and database name bound.
/** Opens a save form for the selected group or launch, retaining values when a save fails. */
export function LibrarySaveForm({
  document,
  selected,
  editable,
  onSaved,
}: {
  document: Design;
  selected: string;
  editable: boolean;
  onSaved: (part: SavedPart) => void;
}) {
  const selection = selectedLayer(document, selected);
  const layer = selection
    ? document.breaks[selection.breakIndex]?.layers.find((item) => item.id === selection.layerId)
    : undefined;
  return (
    <Modal
      title="Save to library"
      description="Keep a reusable copy for catalogue editors. Existing fireworks keep their own values."
      trigger={
        <Button
          size="sm"
          variant="outline"
          disabled={!editable || (!layer && document.launch === null)}
        >
          Save to library
        </Button>
      }
    >
      <SaveForm
        key={`${selected}:${document.kind}`}
        document={partEnvelope(document, selected)}
        hasLayer={layer !== undefined}
        defaultName={layer?.name ?? 'Launch tail'}
        onSaved={onSaved}
      />
    </Modal>
  );
}
function SaveForm({
  document,
  hasLayer,
  defaultName,
  onSaved,
}: {
  document: Design;
  hasLayer: boolean;
  defaultName: string;
  onSaved: (part: SavedPart) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [category, setCategory] = useState<SavedPart['category']>(hasLayer ? 'stars' : 'tails');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(false);
  const save = async () => {
    setPending(true);
    setMessage('');
    try {
      const result = await saveLibraryPart({ name, category, design: document });
      if (result.kind === 'error') setMessage(result.message);
      else {
        onSaved(result.part);
        setSaved(true);
        setMessage('Saved to library');
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'The library could not be saved. Try again.',
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save().catch((error: unknown) => {
          setMessage(String(error));
        });
      }}
    >
      <label className="grid gap-2">
        Name
        <Input
          value={name}
          required
          maxLength={NAME_MAX_LENGTH}
          disabled={pending || saved}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
      </label>
      <label className="grid gap-2">
        Part
        <select
          className="border-input bg-background rounded-md border p-2"
          value={category}
          disabled={pending || saved}
          onChange={(event) => {
            const value = partCategorySchema.safeParse(event.target.value);
            if (value.success) setCategory(value.data);
          }}
        >
          {hasLayer && (
            <>
              <option value="stars">Star group</option>
              <option value="trails">Trail</option>
              <option value="effects">Effects</option>
            </>
          )}
          {document.launch && <option value="tails">Launch tail</option>}
        </select>
      </label>
      {message !== '' && <p role={saved ? 'status' : 'alert'}>{message}</p>}
      <Button type="submit" disabled={pending || saved}>
        {pending ? 'Saving...' : 'Save part'}
      </Button>
    </form>
  );
}
