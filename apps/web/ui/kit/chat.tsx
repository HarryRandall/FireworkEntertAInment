/** Chat presentation and prompts without a network or AI dependency. */
'use client';
import { useState, type ReactNode } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { cn } from '@/lib/utils';

/** Presents a user or assistant message. */
export function ChatBubble({
  from,
  children,
}: {
  from: 'user' | 'assistant';
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'grid max-w-[85%] gap-2 rounded-2xl px-4 py-3 text-sm',
        from === 'user'
          ? 'bg-foreground text-background justify-self-end rounded-br-md'
          : 'bg-muted text-foreground justify-self-start rounded-bl-md',
      )}
    >
      <span className="sr-only">{from === 'user' ? 'You' : 'ShowCrafter'}: </span>
      <div>{children}</div>
    </div>
  );
}

/** Announces that a reply is being prepared; reduced motion leaves the dots still. */
export function TypingIndicator() {
  return (
    <div role="status" className="bg-muted flex w-fit gap-1 rounded-2xl rounded-bl-md p-4">
      <span className="sr-only">Preparing a reply</span>
      {[0, 1, 2].map((dot) => (
        <span key={dot} className="sc-typing-dot bg-muted-foreground size-1.5 rounded-full" />
      ))}
    </div>
  );
}

/** Keeps typed text after submission until the caller accepts it; no transport is implied. */
export function ChatPrompt({
  onSubmit,
  pending = false,
  suggestions = [],
  label = 'Describe your show',
}: {
  onSubmit: (text: string) => void;
  pending?: boolean;
  suggestions?: readonly string[];
  label?: string;
}) {
  const [text, setText] = useState('');
  return (
    <div className="grid gap-2">
      {suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              type="button"
              variant="outline"
              size="xs"
              disabled={pending}
              onClick={() => setText(suggestion)}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      ) : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (text.trim().length > 0) onSubmit(text.trim());
        }}
        className="border-border bg-card shadow-card flex items-end gap-2 rounded-xl border p-3"
      >
        <textarea
          aria-label={label}
          placeholder={label}
          rows={1}
          value={text}
          disabled={pending}
          onChange={(event) => setText(event.target.value)}
          className="min-w-0 flex-1 resize-none bg-transparent text-sm outline-none"
        />
        <Button
          type="submit"
          size="icon-sm"
          aria-label="Send"
          disabled={pending || text.trim().length === 0}
        >
          <ArrowUp />
        </Button>
      </form>
    </div>
  );
}
