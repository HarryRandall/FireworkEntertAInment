'use client';

import { useState } from 'react';
import { effectTemplates } from '@showcrafter/renderer';
import { SelectField } from '@/ui/patterns/SelectField';
import { EmptyState } from '@/ui/patterns/Feedback';
import { PreviewSurface } from './PreviewSurface';

const options = effectTemplates.map(({ key, name, group }) => ({
  value: key,
  label: name,
  description: group,
}));

/** Lists every built-in template and mounts its selected playback surface. */
export default function PreviewLibrary() {
  const [key, setKey] = useState<string>(effectTemplates[0]?.key ?? '');
  const selected = effectTemplates.find((template) => template.key === key);
  if (!selected) return <EmptyState title="No renderer templates available" />;
  return (
    <div className="space-y-4">
      <SelectField ariaLabel="Effect template" value={key} onChange={setKey} options={options} />
      <p className="text-muted-foreground text-sm">
        {effectTemplates.length} templates · {selected.group}
      </p>
      <PreviewSurface key={selected.key} template={selected} />
    </div>
  );
}
