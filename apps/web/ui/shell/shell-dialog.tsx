/** Controlled Radix dialog shared by keyboard-opened workspace panels. */
'use client';
import { useRef, type ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import { X } from 'lucide-react';
import { Button } from '@/ui/primitives/button';

/** Traps panel focus, labels its purpose and restores focus on dismissal. */
export function ShellDialog({
  title,
  description,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  description: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const previousFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-stage/60 fixed inset-0 z-40" />
        <Dialog.Content
          onOpenAutoFocus={() => {
            previousFocus.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (previousFocus.current?.isConnected === true) previousFocus.current.focus();
            else document.querySelector<HTMLButtonElement>('.sc-shell-mobile-menu')?.focus();
          }}
          className="border-border bg-card text-foreground shadow-card fixed top-1/2 left-1/2 z-50 grid max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 overflow-auto rounded-xl border p-5"
        >
          <Dialog.Title className="pr-8 text-lg font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="text-muted-foreground text-sm">
            {description}
          </Dialog.Description>
          {children}
          <Dialog.Close asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close"
              className="absolute top-3 right-3"
            >
              <X />
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
