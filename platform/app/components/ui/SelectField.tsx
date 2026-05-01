"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type SelectFieldProps = {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  iconLeft?: ReactNode;
};

export function SelectField({
  name,
  value,
  defaultValue,
  onChange,
  options,
  placeholder = "Select…",
  required,
  disabled,
  className,
  ariaLabel,
  iconLeft,
}: SelectFieldProps) {
  const isControlled = typeof value === "string";
  const [internal, setInternal] = useState<string>(defaultValue ?? "");
  const current = isControlled ? value! : internal;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();

  const selected = useMemo(
    () => options.find((o) => o.value === current) ?? null,
    [options, current],
  );

  const choose = (next: string) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        listRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === current);
      setActiveIndex(idx >= 0 ? idx : 0);
    }
  }, [open, options, current]);

  const onTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onListKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(options.length - 1, i + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const opt = options[activeIndex];
      if (opt && !opt.disabled) choose(opt.value);
    }
  };

  return (
    <div className={cn("relative", className)}>
      {name ? (
        <input type="hidden" name={name} value={current} required={required} />
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "flex h-11 w-full cursor-pointer items-center gap-2 rounded-lg border border-outline/55 bg-surface px-3 text-left text-sm font-semibold text-on-surface transition-all duration-200 focus:outline-none focus:border-primary/55 focus:ring-2 focus:ring-primary/30",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        {iconLeft ? <span className="text-outline">{iconLeft}</span> : null}
        <span
          className={cn(
            "flex-1 truncate",
            !selected && "text-on-surface-variant/70 font-medium",
          )}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={cn(
            "shrink-0 text-on-surface-variant transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <ul
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          onKeyDown={onListKeyDown}
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-72 overflow-auto rounded-xl border border-outline/55 bg-surface p-1.5 shadow-[var(--shadow-modal)]"
        >
          {options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-on-surface-variant">
              No options
            </li>
          ) : null}
          {options.map((option, index) => {
            const isSelected = option.value === current;
            const isActive = index === activeIndex;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={option.disabled}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => !option.disabled && choose(option.value)}
                  className={cn(
                    "flex w-full cursor-pointer items-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45",
                    option.disabled && "cursor-not-allowed opacity-50",
                    isActive && !option.disabled
                      ? "bg-surface-container-high text-on-surface"
                      : "text-on-surface-variant",
                    isSelected && "text-primary",
                  )}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block truncate font-semibold">
                      {option.label}
                    </span>
                    {option.description ? (
                      <span className="mt-0.5 block truncate text-xs text-on-surface-variant">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                  {isSelected ? (
                    <Check size={14} className="mt-0.5 shrink-0 text-primary" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
