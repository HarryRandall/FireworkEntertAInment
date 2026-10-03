/** Menus, dialogs and side sheets adapted from shadcn's Radix composition. */
'use client';
import type { ReactNode } from 'react';
import { Dialog, DropdownMenu, Tabs as RadixTabs } from 'radix-ui';
import { X } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { cn } from '@/lib/utils';

/** Traps focus and restores it to the trigger when the dismissible modal closes. */
export function Modal({
  title,
  description,
  trigger,
  children,
  side = false,
  open,
  onOpenChange,
  wide = false,
}: {
  title: string;
  description: string;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  wide?: boolean;
  children: ReactNode;
  side?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger !== undefined && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="bg-stage/60 fixed inset-0 z-40" />
        <Dialog.Content
          className={cn(
            'border-border bg-card text-foreground shadow-card fixed z-50 grid gap-4 border p-6',
            side
              ? 'inset-y-0 right-0 w-full max-w-sm content-start overflow-auto'
              : 'top-1/2 left-1/2 max-h-[90vh] w-[calc(100%_-_2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl',
            wide && !side && 'max-w-3xl',
          )}
        >
          <Dialog.Title className="pr-8 text-lg font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="text-muted-foreground text-sm">
            {description}
          </Dialog.Description>
          {children}
          <Dialog.Close asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-4 right-4"
              aria-label="Close"
            >
              <X />
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
/** Action available in a context menu. */
export interface MenuAction {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}
/** Opens a keyboard-navigable context menu anchored to its trigger. */
export function ActionMenu({
  trigger,
  actions,
}: {
  trigger: ReactNode;
  actions: readonly MenuAction[];
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="border-border bg-popover text-popover-foreground shadow-card z-50 min-w-44 rounded-lg border p-1"
        >
          {actions.map((action) => (
            <DropdownMenu.Item
              key={action.label}
              disabled={action.disabled}
              onSelect={action.onSelect}
              className={cn(
                'data-[highlighted]:bg-accent cursor-default rounded px-3 py-2 text-sm outline-none data-[disabled]:opacity-50',
                action.danger === true && 'text-destructive',
              )}
            >
              {action.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
/** Keeps tab panels within one page using Radix's keyboard and ARIA linkage. */
export function Tabs({
  items,
  defaultValue,
}: {
  items: readonly { value: string; label: string; content: ReactNode }[];
  defaultValue: string;
}) {
  return (
    <RadixTabs.Root defaultValue={defaultValue}>
      <RadixTabs.List aria-label="Sections" className="border-border flex flex-wrap gap-4 border-b">
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.value}
            value={item.value}
            className="text-muted-foreground data-[state=active]:border-foreground data-[state=active]:text-foreground border-b-2 border-transparent px-1 py-2 text-sm"
          >
            {item.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {items.map((item) => (
        <RadixTabs.Content key={item.value} value={item.value} className="py-4 text-sm">
          {item.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
