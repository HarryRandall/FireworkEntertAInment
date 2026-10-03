/** Chat presentation and prompts without a network or AI dependency. */
'use client';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/ui/primitives/button';

/** Presents a user or assistant message and optional explicit change details. */
export function ChatBubble({
  from,
  children,
  changes = [],
}: {
  from: 'user' | 'assistant';
  children: ReactNode;
  changes?: readonly { text: string; kind: 'added' | 'removed' }[];
}) {
  return (
    <div
      className={`grid max-w-[82%] gap-2 rounded-2xl px-4 py-3 text-sm ${from === 'user' ? 'bg-foreground text-background justify-self-end rounded-br-md' : 'bg-muted justify-self-start rounded-bl-md'}`}
    >
      <span className="sr-only">{from === 'user' ? 'You' : 'ShowCrafter'}: </span>
      <div>{children}</div>
      {changes.map((change) => (
        <div
          key={change.text}
          className={
            change.kind === 'added'
              ? 'text-highlight-foreground text-xs'
              : 'text-destructive text-xs line-through'
          }
        >
          {change.kind === 'added' ? '+ ' : 'Removed: '}
          {change.text}
        </div>
      ))}
    </div>
  );
}
/** Announces typing; reduced motion leaves the dots still. */
export function TypingIndicator() {
  return (
    <div role="status" className="bg-muted flex w-fit gap-1 rounded-2xl p-4">
      <span className="sr-only">Preparing a reply</span>
      {[0, 1, 2].map((dot) => (
        <span key={dot} className="sc-typing-dot bg-muted-foreground size-1.5 rounded-full" />
      ))}
    </div>
  );
}
/** Keeps a typed change after submission until the caller accepts it; no transport is implied. */
export function ChatPrompt({
  onSubmit,
  pending = false,
  suggestions = [],
  maxLength,
}: {
  onSubmit: (text: string) => void;
  pending?: boolean;
  suggestions?: readonly string[];
  maxLength?: number;
}) {
  const [text, setText] = useState('');
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <Button
            key={suggestion}
            type="button"
            variant="outline"
            size="xs"
            disabled={pending}
            onClick={() => {
              setText(suggestion);
            }}
          >
            {suggestion}
          </Button>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (text.trim().length > 0) {
            onSubmit(text.trim());
          }
        }}
        className="border-border bg-card shadow-card flex items-end gap-2 rounded-xl border p-3"
      >
        <textarea
          aria-label="Ask for a change"
          placeholder="Ask for a change"
          rows={1}
          maxLength={maxLength}
          value={text}
          disabled={pending}
          onChange={(event) => {
            setText(event.target.value);
          }}
          className="min-w-0 flex-1 resize-y bg-transparent text-sm"
        />
        <Button
          type="submit"
          size="icon-sm"
          aria-label="Send change request"
          disabled={pending || text.trim().length === 0}
        >
          <ArrowUp />
        </Button>
      </form>
    </div>
  );
}
