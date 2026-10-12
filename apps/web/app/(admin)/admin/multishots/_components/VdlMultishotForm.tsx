'use client';

/** Paste one Finale VDL cake line, preview its shots and fireworks, then create the multishot. */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/ui/patterns/Button';
import { Badge } from '@/ui/patterns/Badge';
import { Field, FieldLabel } from '@/ui/patterns/Field';
import { Input, Textarea } from '@/ui/patterns/Input';
import { InlineAlert } from '@/ui/patterns/Feedback';
import { DialogFooter } from '@/ui/primitives/dialog';
import { toast } from '@/ui/patterns/toast';
import type { VdlPreviewSummary } from '@/lib/finale/vdl/preview';
import { createVdlMultishot, previewVdlMultishot } from '../vdl-actions';

const MILLISECONDS_PER_SECOND = 1000; // SI milliseconds per second.
const PERCENT = 100; // Timeline position scale.

function seconds(milliseconds: number): string {
  return `${(milliseconds / MILLISECONDS_PER_SECOND).toFixed(2).replace(/\.?0+$/, '')} s`;
}

function ShotTimeline({ preview }: { preview: VdlPreviewSummary }) {
  const lastMs = Math.max(1, preview.shots.at(-1)?.timeMs ?? 1);
  const letters = preview.parts.map((part) => part.letter);
  return (
    <div className="space-y-1">
      <div
        className="bg-muted relative rounded-md"
        style={{ height: `${Math.max(2, letters.length) * 0.75}rem` }}
        aria-label={`${preview.shots.length} shots over ${seconds(lastMs)}`}
        role="img"
      >
        {preview.shots.map((shot) => (
          <span
            key={shot.sequence}
            title={`(${shot.letter}) ${seconds(shot.timeMs)}, ${shot.angleDeg} degrees`}
            className="bg-primary absolute h-2 w-2 -translate-x-1/2 rounded-full"
            style={{
              left: `${(shot.timeMs / lastMs) * PERCENT}%`,
              top: `${letters.indexOf(shot.letter) * 0.75 + 0.125}rem`,
            }}
          />
        ))}
      </div>
      <div className="text-muted-foreground flex justify-between text-xs">
        <span>0 s</span>
        <span>{seconds(lastMs)}</span>
      </div>
    </div>
  );
}

function PartList({ preview }: { preview: VdlPreviewSummary }) {
  return (
    <ul className="divide-border divide-y text-sm">
      {preview.parts.map((part) => (
        <li key={part.letter} className="space-y-1.5 py-2">
          <p>
            <span className="font-medium">({part.letter})</span>{' '}
            {part.encoded ? (
              <>
                <Badge tone="info">Edited in Finale</Badge> {part.phrase}
              </>
            ) : (
              part.text
            )}
          </p>
          {part.error ? (
            <InlineAlert tone="danger" title="This part could not be read">
              {part.error}
            </InlineAlert>
          ) : null}
          <ul className="space-y-1 pl-4">
            {part.fireworks.map((key) => {
              const firework = preview.fireworks[key];
              return (
                <li key={key} className="flex flex-wrap items-center gap-2">
                  {firework.match ? (
                    <Badge tone="success">Uses existing</Badge>
                  ) : (
                    <Badge tone="info">Will create</Badge>
                  )}
                  <span>{firework.name}</span>
                  {firework.match ? null : (
                    <span className="text-muted-foreground text-xs">
                      {firework.family} from {firework.templateName}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {part.unknownWords.length ? (
            <p className="text-status-warning text-xs">
              Unknown words, skipped: {part.unknownWords.join(', ')}
            </p>
          ) : null}
          {part.approximations.map((note) => (
            <p key={note} className="text-muted-foreground text-xs">
              {note}
            </p>
          ))}
        </li>
      ))}
    </ul>
  );
}

export function VdlMultishotForm({ onCancel }: { onCancel: () => void }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [preview, setPreview] = useState<VdlPreviewSummary | null>(null);
  const [invalidWords, setInvalidWords] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const blocked = preview?.parts.some((part) => part.error !== null) ?? true;
  const newCount = preview
    ? Object.values(preview.fireworks).filter((firework) => firework.match === null).length
    : 0;

  async function read() {
    setPending(true);
    setError(null);
    try {
      const result = await previewVdlMultishot(text);
      if (!result.ok) {
        setPreview(null);
        setError(result.error);
        return;
      }
      setPreview(result.preview);
      setInvalidWords(result.invalidWords);
      if (name.trim() === '') setName(result.preview.name);
    } catch {
      setError('The line could not be previewed. Please try again.');
    } finally {
      setPending(false);
    }
  }

  async function create() {
    setPending(true);
    setError(null);
    try {
      const result = await createVdlMultishot({ text, name: name.trim() });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success('Multishot created');
      router.push(`/admin/multishots/${result.id}`);
    } catch {
      setError('The multishot could not be created. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <Field>
        <FieldLabel htmlFor="vdl-line">Finale VDL line</FieldLabel>
        <Textarea
          id="vdl-line"
          rows={4}
          value={text}
          disabled={pending}
          placeholder="30mm 24 Shot Cake (a) Red Peony + (b) Blue Peony, 1 Row (0a500/b/a/CAK)"
          onChange={(event) => {
            setText(event.target.value);
            setPreview(null);
            setError(null);
          }}
        />
      </Field>
      {error ? (
        <InlineAlert tone="danger" title="This line could not be used">
          {error}
        </InlineAlert>
      ) : null}
      {invalidWords.length ? (
        <InlineAlert tone="warning" title="Some saved words were skipped">
          These saved words no longer have a valid meaning: {invalidWords.join(', ')}.
        </InlineAlert>
      ) : null}
      {preview ? (
        <div className="space-y-4">
          <Field>
            <FieldLabel htmlFor="vdl-name">Name</FieldLabel>
            <Input id="vdl-name" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground text-xs">Caliber</dt>
              <dd>{preview.caliberText ?? 'Not given'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Prefire</dt>
              <dd>{preview.prefireS} s</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Shots</dt>
              <dd>
                {preview.shotCount} tubes, {preview.shots.length} fireworks fired
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Last shot</dt>
              <dd>{seconds(preview.lastShotS * MILLISECONDS_PER_SECOND)}</dd>
            </div>
          </dl>
          {preview.rows ? (
            <p className="text-muted-foreground text-xs">
              {preview.rows
                .map(
                  (row) =>
                    `Row ${row.rows.join(',')}: ${row.labels.join('')} ${row.pattern}${row.durationS === null ? '' : ` over ${row.durationS} s`}`,
                )
                .join(' · ')}
            </p>
          ) : null}
          <ShotTimeline preview={preview} />
          {preview.warnings.map((warning) => (
            <InlineAlert key={warning} tone="warning" title="Check this">
              {warning}
            </InlineAlert>
          ))}
          <PartList preview={preview} />
          <p className="text-muted-foreground text-xs">
            {newCount === 0
              ? 'Every firework already exists.'
              : `${newCount} new firework${newCount === 1 ? '' : 's'} will be created from base effects.`}{' '}
            <Link className="underline" href="/admin/multishots/vdl-glossary">
              Edit VDL words
            </Link>
          </p>
        </div>
      ) : null}
      <DialogFooter>
        <Button variant="secondary" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="secondary"
          loading={pending && !preview}
          disabled={pending || text.trim() === ''}
          onClick={() => void read()}
        >
          Preview
        </Button>
        <Button
          loading={pending && preview !== null}
          disabled={pending || blocked || name.trim() === ''}
          onClick={() => void create()}
        >
          Create multishot
        </Button>
      </DialogFooter>
    </div>
  );
}
