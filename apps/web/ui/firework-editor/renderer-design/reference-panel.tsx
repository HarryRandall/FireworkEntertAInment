/** Choose a local clip of the real firework to compare beside the preview. */
'use client';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { ReferenceClip } from '@/lib/renderer-editor/reference';
import { Button } from '@/ui/patterns/Button';
import { SliderField } from '@/ui/patterns/SliderField';

const MAX_OFFSET_S = 30; // Seconds of lead-in a clip can have before the firework is lit.
const OFFSET_STEP_S = 0.05; // Seconds, about one to two video frames.

/** Owns the clip's object URL, releasing it when the clip is replaced, removed or the editor closes. */
export function useReferenceClip() {
  const [clip, setClip] = useState<ReferenceClip | null>(null);
  const url = useRef<string | null>(null);
  const release = () => {
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
  };
  useEffect(() => release, []);
  return {
    clip,
    choose: (file: File) => {
      release();
      url.current = URL.createObjectURL(file);
      setClip({ url: url.current, name: file.name, offsetS: 0 });
    },
    setOffset: (offsetS: number) =>
      setClip((current) => (current ? { ...current, offsetS } : null)),
    clear: () => {
      release();
      setClip(null);
    },
  };
}

/** File chooser, drop target and firing offset for the reference clip. */
export function ReferencePanel({ reference }: { reference: ReturnType<typeof useReferenceClip> }) {
  const [failure, setFailure] = useState('');
  const choose = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setFailure('Choose a video clip.');
      return;
    }
    setFailure('');
    reference.choose(file);
  };
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        Play a clip of the real firework beside the preview. Both follow the same play, pause and
        scrubber. The clip stays on this computer and is not uploaded.
      </p>
      <label
        className="border-border hover:border-primary flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed p-4 text-center text-xs"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          choose(event.dataTransfer.files[0]);
        }}
      >
        <span className="font-medium">
          {reference.clip?.name ?? 'Drop a clip or choose a file'}
        </span>
        <span className="text-muted-foreground">MP4, MOV or WebM</span>
        <input
          type="file"
          accept="video/*"
          aria-label="Reference video clip"
          className="sr-only"
          onChange={(event) => choose(event.target.files?.[0])}
        />
      </label>
      {failure && (
        <p role="alert" className="text-status-danger text-xs">
          {failure}
        </p>
      )}
      {reference.clip && (
        <>
          <SliderField
            label="Firework is lit at"
            value={reference.clip.offsetS}
            min={0}
            max={MAX_OFFSET_S}
            step={OFFSET_STEP_S}
            unit="s"
            formatValue={(value) => value.toFixed(2)}
            onChange={reference.setOffset}
          />
          <p className="text-muted-foreground text-xs">
            Set this to the moment the firework is lit in the clip so both start together.
          </p>
          <Button variant="secondary" onClick={reference.clear}>
            <X size={14} /> Remove clip
          </Button>
        </>
      )}
    </div>
  );
}
