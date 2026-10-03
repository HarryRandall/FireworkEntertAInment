/** Controlled single-file dropzone adapted from ReUI's use-file-upload. */
'use client';
import { useId, useRef, useState } from 'react';
import { FileIcon, Upload, X } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { fileError } from './file-upload-logic';

/** Selects one local file without uploading it; browse and drop share type/size validation. */
export function FileUpload({
  label,
  hint,
  accept,
  maxBytes,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  hint: string;
  accept: string;
  maxBytes: number;
  value: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  function choose(file: File | undefined) {
    if (disabled || file === undefined) {
      return;
    }
    const message = fileError(file, accept, maxBytes);
    setError(message);
    if (message === null) {
      onChange(file);
    }
  }
  return (
    <div className="grid gap-2">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) {
            setDragging(true);
          }
        }}
        onDragLeave={() => {
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          choose(event.dataTransfer.files[0]);
        }}
        className={`grid justify-items-center gap-2 rounded-lg border border-dashed p-6 text-center ${dragging ? 'border-highlight bg-highlight-soft' : 'border-border-strong bg-muted/30'}`}
      >
        <Upload className="text-muted-foreground size-6" />
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
        <input
          id={id}
          ref={input}
          type="file"
          accept={accept}
          disabled={disabled}
          aria-describedby={`${id}-hint`}
          className="sr-only"
          onChange={(event) => {
            choose(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => input.current?.click()}
        >
          Browse files
        </Button>
      </div>
      {value !== null && (
        <FileRow
          name={value.name}
          disabled={disabled}
          onRemove={() => {
            onChange(null);
            setError(null);
          }}
        />
      )}
      {error !== null && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

function FileRow({
  name,
  disabled,
  onRemove,
}: {
  name: string;
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="border-border flex items-center gap-3 rounded-md border p-3 text-sm">
      <FileIcon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={disabled}
        aria-label={`Remove ${name}`}
        onClick={onRemove}
      >
        <X />
      </Button>
    </div>
  );
}
