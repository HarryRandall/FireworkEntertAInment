/** Synthetic workspace review, including editor slots and visibility filtering. */
'use client';
import { useState } from 'react';
import { WorkspaceShell } from '@/ui/shell/workspace-shell';
import { WorkspacePlaceholder } from '@/ui/shell/placeholder';
import { areaConfigs } from '@/ui/shell/config';
import type { WorkspaceArea } from '@/ui/shell/config/types';
import { ReviewControls } from './review-controls';

const organisations = [
  {
    id: 'hartley',
    label: 'Hartley Fireworks',
    stores: [
      { id: 'leeds', label: 'Leeds, Kirkstall' },
      { id: 'york', label: 'York, Clifton Moor' },
    ],
  },
  { id: 'demo', label: 'Demo Fireworks', stores: [{ id: 'demo-shop', label: 'Demo shop' }] },
];
const notifications = [
  {
    id: 'preview',
    title: 'Shell review ready',
    description: 'Synthetic notification for this browser only',
    when: 'Now',
    unread: true,
  },
];

/** Reviews editor regions without implementing any firework editing or storage. */
function EditorPreview() {
  return (
    <div className="sc-shell-review-editor">
      <section aria-label="Library" className="border-border border-r p-4">
        <h2 className="font-semibold">Library</h2>
        <p className="text-muted-foreground mt-3 text-sm">Library panel placeholder</p>
      </section>
      <section
        aria-label="Editor stage"
        className="bg-stage text-stage-foreground flex flex-col p-4"
      >
        <h1 className="text-lg font-semibold">Editor frame</h1>
        <p className="mt-auto text-sm">Stage and timeline placeholder</p>
      </section>
      <section aria-label="Inspector" className="border-border border-l p-4">
        <h2 className="font-semibold">Inspector</h2>
        <p className="text-muted-foreground mt-3 text-sm">Inspector placeholder</p>
      </section>
    </div>
  );
}
/** Exercises all shell areas and panels with clearly labelled local fixture state. */
export function ShellReview() {
  const [area, setArea] = useState<WorkspaceArea>('retailer');
  const [editor, setEditor] = useState(false);
  const [filtered, setFiltered] = useState(false);
  const [status, setStatus] = useState('');
  return (
    <div>
      <ReviewControls
        area={area}
        setArea={(value) => {
          setArea(value);
          setEditor(false);
        }}
        editor={editor}
        toggleEditor={() => {
          setArea('admin');
          setEditor((value) => !value);
        }}
        filtered={filtered}
        setFiltered={setFiltered}
        status={status}
      />
      <WorkspaceShell
        key={area + String(editor) + String(filtered)}
        area={area}
        pathname={editor ? '/admin/studio' : areaConfigs[area].href}
        organisations={organisations}
        notifications={notifications}
        visibility={
          filtered
            ? {
                area: (candidate) => candidate === area,
                item: (item) => item.href === areaConfigs[area].href,
              }
            : undefined
        }
        editorFrame={
          editor
            ? {
                title: 'Example effect',
                onSave: () => {
                  setStatus('Preview save clicked. No data was written.');
                },
                actions: [
                  {
                    label: 'Inspect frame',
                    onSelect: () => {
                      setStatus('Editor frame inspected.');
                    },
                  },
                ],
              }
            : undefined
        }
      >
        {editor ? (
          <EditorPreview />
        ) : (
          <WorkspacePlaceholder title={`${areaConfigs[area].label} shell`} />
        )}
      </WorkspaceShell>
    </div>
  );
}
