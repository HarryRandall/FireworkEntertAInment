/** Controlled layer tree with independently operable selection, expansion and visibility. */
'use client';
import { ChevronDown, ChevronRight, Eye, EyeOff, Layers } from 'lucide-react';
import { Button } from '@/ui/primitives/button';

/** Flat visible tree row; the caller supplies hierarchy and expanded descendants. */
export interface LayerItem {
  id: string;
  name: string;
  depth?: number;
  colour?: string;
  badge?: string;
  hidden?: boolean;
  expanded?: boolean;
  hasChildren?: boolean;
}
const INDENT_PX = 16; // Prototype layer hierarchy indentation, CSS pixels per level.
/** Edits preview visibility separately from selected layer and tree expansion. */
export function LayerList({
  items,
  selected,
  onSelect,
  onVisibilityChange,
  onExpandedChange,
}: {
  items: readonly LayerItem[];
  selected: string;
  onSelect: (id: string) => void;
  onVisibilityChange: (id: string, visible: boolean) => void;
  onExpandedChange: (id: string, expanded: boolean) => void;
}) {
  return (
    <ul aria-label="Effect layers" className="grid gap-px">
      {items.map((item) => (
        <li
          key={item.id}
          style={{ paddingLeft: (item.depth ?? 0) * INDENT_PX }}
          className={`group/layer flex items-center gap-1 rounded-md ${selected === item.id ? 'bg-highlight-soft' : 'hover:bg-accent'}`}
        >
          {item.hasChildren === true ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-(--layer-control-size)"
              aria-label={`${item.expanded === true ? 'Collapse' : 'Expand'} ${item.name}`}
              aria-expanded={item.expanded === true}
              onClick={() => {
                onExpandedChange(item.id, item.expanded !== true);
              }}
            >
              {item.expanded === true ? <ChevronDown /> : <ChevronRight />}
            </Button>
          ) : (
            <span className="w-(--layer-control-size)" />
          )}
          <button
            type="button"
            aria-pressed={selected === item.id}
            onClick={() => {
              onSelect(item.id);
            }}
            className={`group group-hover/layer:text-foreground aria-pressed:text-highlight-foreground flex min-h-(--layer-row-height) min-w-0 flex-1 items-center gap-2 text-left text-sm ${item.hidden === true ? 'text-muted-foreground' : 'text-foreground'}`}
          >
            {item.colour === undefined ? (
              <Layers className="text-muted-foreground size-3.5 shrink-0" />
            ) : (
              <span
                style={{ backgroundColor: item.colour }}
                className="size-3 shrink-0 rounded-sm"
              />
            )}
            <span className="truncate">{item.name}</span>
            <span className="text-muted-foreground group-hover/layer:text-foreground group-aria-pressed:text-highlight-foreground ml-auto font-mono text-xs">
              {item.badge}
            </span>
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-(--layer-control-size)"
            aria-label={`${item.hidden === true ? 'Show' : 'Hide'} ${item.name}`}
            aria-pressed={item.hidden !== true}
            onClick={() => {
              onVisibilityChange(item.id, item.hidden === true);
            }}
          >
            {item.hidden === true ? <EyeOff /> : <Eye />}
          </Button>
        </li>
      ))}
    </ul>
  );
}
