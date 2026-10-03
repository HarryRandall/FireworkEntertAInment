/** Workspace and retailer context selectors, independent of authentication. */
'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { ActionMenu } from '@/ui/kit/overlays';
import { areaConfigs } from './config';
import type { AreaConfig, ShellVisibility } from './config/types';

/** Offers only areas allowed by the caller's optional visibility predicate. */
export function AreaSwitcher({
  config,
  visibility,
}: {
  config: AreaConfig;
  visibility?: ShellVisibility;
}) {
  const router = useRouter();
  return (
    <ActionMenu
      trigger={
        <button type="button" className="sc-shell-picker" aria-label="Switch area">
          {config.label}
          <ChevronsUpDown aria-hidden="true" />
        </button>
      }
      actions={Object.values(areaConfigs)
        .filter((area) => visibility?.area?.(area.area) !== false)
        .map((area) => ({
          label: area.label,
          onSelect: () => {
            router.push(area.href);
          },
        }))}
    />
  );
}
/** An organisation and its available stores supplied by the retailer route. */
export interface OrganisationOption {
  id: string;
  label: string;
  stores: readonly { id: string; label: string }[];
}
/** Keeps the selected organisation and store together in local preview state. */
export function RetailerSwitcher({
  organisations,
}: {
  organisations: readonly OrganisationOption[];
}) {
  const [organisationId, setOrganisationId] = useState<string | undefined>(organisations[0]?.id);
  const organisation = organisations.find((item) => item.id === organisationId);
  const stores = organisation?.stores ?? [];
  const [storeId, setStoreId] = useState<string | undefined>(stores[0]?.id);
  const store = stores.find((item) => item.id === storeId);
  return (
    <div className="grid gap-2">
      <ContextPicker
        label="Switch organisation"
        value={organisation?.label ?? 'No organisation'}
        options={organisations}
        onSelect={(id) => {
          setOrganisationId(id);
          setStoreId(organisations.find((item) => item.id === id)?.stores[0]?.id);
        }}
      />
      <ContextPicker
        label="Switch store"
        value={store?.label ?? 'No store'}
        options={stores}
        onSelect={setStoreId}
      />
    </div>
  );
}
/** Reuses the registry menu for context choices rather than a custom dropdown. */
function ContextPicker({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: readonly { id: string; label: string }[];
  onSelect: (id: string) => void;
}) {
  return (
    <ActionMenu
      trigger={
        <button
          className="sc-shell-picker"
          type="button"
          aria-label={label}
          disabled={options.length === 0}
        >
          {value}
          <ChevronsUpDown aria-hidden="true" />
        </button>
      }
      actions={options.map((item) => ({
        label: item.label,
        onSelect: () => {
          onSelect(item.id);
        },
      }))}
    />
  );
}
