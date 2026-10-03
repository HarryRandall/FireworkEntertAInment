/** Controls for reviewing shell variants, theme and visibility. */
'use client';
import { useTheme } from 'next-themes';
import { areaConfigs } from '@/ui/shell/config';
import type { WorkspaceArea } from '@/ui/shell/config/types';
import { Button } from '@/ui/primitives/button';

/** Keeps review-only state outside the product's workspace controls. */
export function ReviewControls({
  area,
  setArea,
  editor,
  toggleEditor,
  filtered,
  setFiltered,
  status,
}: {
  area: WorkspaceArea;
  setArea: (area: WorkspaceArea) => void;
  editor: boolean;
  toggleEditor: () => void;
  filtered: boolean;
  setFiltered: (value: boolean) => void;
  status: string;
}) {
  const { setTheme } = useTheme();
  return (
    <section
      aria-label="Shell review controls"
      className="border-border bg-card flex flex-wrap items-center gap-3 border-b p-3"
    >
      <label className="text-sm">
        Review area{' '}
        <select
          aria-label="Review area"
          value={area}
          onChange={(event) => {
            const config = Object.values(areaConfigs).find(
              (item) => item.area === event.target.value,
            );
            if (config) setArea(config.area);
          }}
          className="border-border bg-card rounded border p-2"
        >
          {Object.values(areaConfigs).map((config) => (
            <option key={config.area} value={config.area}>
              {config.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Theme{' '}
        <select
          aria-label="Theme"
          defaultValue="system"
          onChange={(event) => {
            setTheme(event.target.value);
          }}
          className="border-border bg-card rounded border p-2"
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </label>
      <Button variant="outline" onClick={toggleEditor}>
        {editor ? 'Workspace frame' : 'Editor frame'}
      </Button>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={filtered}
          onChange={(event) => {
            setFiltered(event.target.checked);
          }}
        />
        Restrict preview navigation
      </label>
      <span role="status" className="text-muted-foreground text-sm">
        {status}
      </span>
    </section>
  );
}
