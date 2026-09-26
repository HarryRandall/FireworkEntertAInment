'use client';

import { Button } from '@/ui/patterns/Button';
import { Field, FieldLabel } from '@/ui/patterns/Field';
import { InfoTooltip } from '@/ui/patterns/InfoTooltip';
import { Input } from '@/ui/patterns/Input';
import { SelectField, type SelectOption } from '@/ui/patterns/SelectField';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/primitives/dialog';
import { NO_STYLE_DEFAULT_VALUE } from '@showcrafter/fireworks/style-defaults';
import { MoreHorizontal, RotateCcw, Save } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/primitives/dropdown-menu';
import { useState } from 'react';

export function EditorStyleDefaultControls({
  label,
  value,
  options,
  disabled,
  saveDisabled,
  resetDisabled,
  inheritedLabel,
  onChange,
  onSave,
  onReset,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  disabled?: boolean;
  saveDisabled?: boolean;
  resetDisabled?: boolean;
  inheritedLabel?: string | null;
  onChange: (value: string) => void;
  onSave: (name: string) => void;
  onReset: () => void;
}) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const isCustom = value === NO_STYLE_DEFAULT_VALUE;

  function openSaveDialog() {
    setDraftName('');
    setSaveDialogOpen(true);
  }

  function confirmSave() {
    const trimmed = draftName.trim();
    if (!trimmed || saveDisabled) return;
    onSave(trimmed);
    setSaveDialogOpen(false);
  }

  return (
    <div className="space-y-3 border-t border-[color:var(--color-border-subtle)] pt-5">
      <Field>
        <div className="flex items-center gap-1.5">
          <FieldLabel>{label}</FieldLabel>
          <InfoTooltip text="Save these settings as a reusable effect, or pick a saved effect to copy its settings into this editor." />
        </div>
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <SelectField
              value={value}
              onChange={onChange}
              options={options}
              ariaLabel={label}
              disabled={disabled}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="size-8 shrink-0 p-0"
                aria-label={`${label} actions`}
                disabled={disabled}
              >
                <MoreHorizontal size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={openSaveDialog} disabled={disabled || saveDisabled}>
                <Save size={14} />
                Save as new preset
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onReset} disabled={disabled || resetDisabled}>
                <RotateCcw size={14} />
                Reset to preset
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {!isCustom && inheritedLabel ? (
          <p className="text-xs text-[color:var(--color-content-muted)]">{inheritedLabel}</p>
        ) : null}
      </Field>
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save {label.toLowerCase()}</DialogTitle>
            <DialogDescription>
              Give this preset a name so you can apply it elsewhere later.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="style-default-save-name">Name</FieldLabel>
            <Input
              id="style-default-save-name"
              autoFocus
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  confirmSave();
                }
              }}
              placeholder="e.g. Gold peony"
            />
          </Field>
          <DialogFooter>
            <Button onClick={confirmSave} disabled={saveDisabled || draftName.trim().length === 0}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
