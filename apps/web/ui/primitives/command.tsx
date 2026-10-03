/** Used command-menu parts adapted from the recorded shadcn registry snapshot. */
'use client';
import type { ComponentProps } from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { cn } from '@/lib/utils';

export function Command(props: ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      {...props}
      className={cn(
        'bg-popover text-popover-foreground overflow-hidden rounded-lg',
        props.className,
      )}
    />
  );
}
export function CommandInput(props: ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <CommandPrimitive.Input
      {...props}
      className="border-border w-full border-b bg-transparent p-3 text-sm"
    />
  );
}
export function CommandList(props: ComponentProps<typeof CommandPrimitive.List>) {
  return <CommandPrimitive.List {...props} className="max-h-72 overflow-y-auto p-2" />;
}
export function CommandEmpty(props: ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty {...props} className="p-4 text-sm" />;
}
export function CommandItem(props: ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      {...props}
      className="data-[selected=true]:bg-accent cursor-default rounded px-3 py-2 text-sm"
    />
  );
}
