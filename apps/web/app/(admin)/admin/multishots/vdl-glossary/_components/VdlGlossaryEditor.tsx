'use client';

/** Searchable VDL word list with an editor for saved meanings. */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/ui/patterns/Button';
import { Badge } from '@/ui/patterns/Badge';
import { Field, FieldLabel } from '@/ui/patterns/Field';
import { Input, Textarea } from '@/ui/patterns/Input';
import { InlineAlert } from '@/ui/patterns/Feedback';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/primitives/dialog';
import { toast } from '@/ui/patterns/toast';
import { deleteVdlWord, saveVdlWord } from '../actions';

export type VdlWordRow = {
  phrase: string;
  id: string | null;
  source: 'built-in' | 'override' | 'added';
  meaning: string;
  definition: string;
  notes: string;
};

type Draft = {
  id: string | null;
  phrase: string;
  definition: string;
  notes: string;
  isNew: boolean;
};

const NEW_WORD: Draft = {
  id: null,
  phrase: '',
  definition: '{\n  "type": "colour",\n  "colours": ["#ff3048"]\n}',
  notes: '',
  isNew: true,
};

export function VdlGlossaryEditor({ rows }: { rows: VdlWordRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const search = query.trim().toLowerCase();
  const visible = rows.filter(
    (row) => !search || row.phrase.includes(search) || row.meaning.toLowerCase().includes(search),
  );

  function save() {
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      const result = await saveVdlWord({
        id: draft.id,
        phrase: draft.phrase,
        definition: draft.definition,
        notes: draft.notes,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success('Word saved');
      setDraft(null);
      router.refresh();
    });
  }

  function remove(row: VdlWordRow) {
    if (!row.id) return;
    const id = row.id;
    startTransition(async () => {
      const result = await deleteVdlWord(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(row.source === 'override' ? 'Built-in meaning restored' : 'Word removed');
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Search words"
          className="max-w-xs"
          placeholder="Search words…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button onClick={() => setDraft(NEW_WORD)}>Add word</Button>
      </div>
      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-left text-xs">
            <tr>
              <th className="px-3 py-2 font-medium">Word</th>
              <th className="px-3 py-2 font-medium">Meaning</th>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {visible.map((row) => (
              <tr key={row.phrase}>
                <td className="px-3 py-2 font-medium">{row.phrase}</td>
                <td className="text-muted-foreground px-3 py-2">{row.meaning}</td>
                <td className="px-3 py-2">
                  <Badge tone={row.source === 'built-in' ? 'neutral' : 'info'}>{row.source}</Badge>
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setDraft({
                        id: row.id,
                        phrase: row.phrase,
                        definition: row.definition,
                        notes: row.notes,
                        isNew: false,
                      })
                    }
                  >
                    Edit
                  </Button>
                  {row.id ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => remove(row)}
                    >
                      {row.source === 'override' ? 'Reset' : 'Remove'}
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={draft !== null} onOpenChange={(open) => (open ? null : setDraft(null))}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{draft?.isNew ? 'Add word' : `Edit "${draft?.phrase}"`}</DialogTitle>
            <DialogDescription>
              Saving a built-in word replaces its meaning for future imports. Existing fireworks are
              not changed.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="space-y-4">
              {draft.isNew ? (
                <Field>
                  <FieldLabel htmlFor="vdl-word">Word or phrase</FieldLabel>
                  <Input
                    id="vdl-word"
                    value={draft.phrase}
                    onChange={(event) => setDraft({ ...draft, phrase: event.target.value })}
                  />
                </Field>
              ) : null}
              <Field>
                <FieldLabel htmlFor="vdl-definition">Meaning (JSON)</FieldLabel>
                <Textarea
                  id="vdl-definition"
                  rows={10}
                  className="font-mono text-xs"
                  value={draft.definition}
                  onChange={(event) => setDraft({ ...draft, definition: event.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="vdl-notes">Notes</FieldLabel>
                <Input
                  id="vdl-notes"
                  value={draft.notes}
                  onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                />
              </Field>
              {error ? (
                <InlineAlert tone="danger" title="Could not save">
                  {error}
                </InlineAlert>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" disabled={pending} onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button loading={pending} onClick={save}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
