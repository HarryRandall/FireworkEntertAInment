/** Controlled tag editing with paste, validation and removable chips. */
'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import { parseTags, isEmailTag } from './input-logic';

/** Keeps invalid invitation emails visible; emits the full immutable tag list after each edit. */
export function TagInput({
  id,
  label,
  value,
  onChange,
  email = false,
  disabled = false,
  placeholder = 'Type and press Enter',
}: {
  id: string;
  label: string;
  value: readonly string[];
  onChange: (tags: string[]) => void;
  email?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const invalid = email && value.some((tag) => !isEmailTag(tag));
  function add(text: string) {
    onChange(parseTags(text, value));
    setDraft('');
  }
  return (
    <div
      className="border-input bg-card flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border p-2"
      aria-disabled={disabled}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs ${email && !isEmailTag(tag) ? 'border-destructive bg-destructive-soft text-destructive' : 'border-border bg-muted'}`}
        >
          {tag}
          <button
            type="button"
            disabled={disabled}
            aria-label={`Remove ${tag}`}
            onClick={() => {
              onChange(value.filter((item) => item !== tag));
            }}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        aria-label={label}
        aria-invalid={invalid}
        disabled={disabled}
        className="min-w-24 flex-1 bg-transparent text-sm outline-none"
        value={draft}
        placeholder={placeholder}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onPaste={(event) => {
          event.preventDefault();
          add(event.clipboardData.getData('text'));
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) {
            return;
          }
          if (['Enter', ',', ';', ' '].includes(event.key) && draft.trim().length > 0) {
            event.preventDefault();
            add(draft);
          } else if (event.key === 'Backspace' && draft.length === 0) {
            onChange(value.slice(0, -1));
          }
        }}
      />
      {invalid && (
        <span className="sr-only" role="status">
          Some email addresses are invalid
        </span>
      )}
    </div>
  );
}
