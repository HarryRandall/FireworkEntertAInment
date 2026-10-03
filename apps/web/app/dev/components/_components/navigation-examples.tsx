/** Workflow, tab, menu, dialog and sheet demonstrations. */
'use client';
import { useState } from 'react';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { AutoField } from '@/ui/kit/field';
import { Steps } from '@/ui/kit/steps';
import { ActionMenu, Modal, Tabs } from '@/ui/kit/overlays';
import { Example, Group } from './example';

const workflow = [
  { id: 'business', title: 'Business', description: 'Name and details' },
  { id: 'locations', title: 'Locations', description: 'Where you sell' },
  { id: 'range', title: 'Your range', description: 'Products and stock' },
  { id: 'launch', title: 'Launch', description: 'Ready to share' },
];
/** Demonstrates reached, current, completed and locked steps alongside focus-managed overlays. */
export function NavigationExamples() {
  const [step, setStep] = useState(1);
  return (
    <Group id="navigation" title="Navigation">
      <Example
        id="steps"
        title="Vertical and horizontal steppers"
        source="ReUI Stepper"
        description="Completed, current and locked states. Reached steps remain keyboard accessible."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <Steps items={workflow} current={step} reached={2} onChange={setStep} />
          <Steps
            items={workflow}
            current={step}
            reached={2}
            orientation="horizontal"
            onChange={setStep}
          />
        </div>
      </Example>
      <Example
        id="tabs"
        title="Tabs"
        source="shadcn Tabs"
        description="Panel tabs stay within the page and support arrow keys."
      >
        <Tabs
          defaultValue="overview"
          items={[
            { value: 'overview', label: 'Overview', content: 'An overview of your range.' },
            {
              value: 'products',
              label: 'Products · 12',
              content: 'Twelve products in this range.',
            },
            { value: 'qr', label: 'QR codes · 4', content: 'Four labels ready to print.' },
          ]}
        />
      </Example>
      <OverlayExamples />
    </Group>
  );
}

function OverlayExamples() {
  const [status, setStatus] = useState('');
  return (
    <Example
      id="overlays"
      title="Menu, dialog and sheet"
      source="shadcn Dropdown Menu + Dialog"
      description="Menus use arrow keys; dialogs trap focus, close with Escape and return focus to the trigger."
    >
      <div className="flex flex-wrap gap-3">
        <ActionMenu
          trigger={<Button variant="outline">Open menu</Button>}
          actions={[
            {
              label: 'Duplicate',
              onSelect: () => {
                setStatus('Show duplicated');
              },
            },
            {
              label: 'Download labels',
              onSelect: () => {
                setStatus('Label download selected');
              },
            },
            {
              label: 'Archive',
              danger: true,
              onSelect: () => {
                setStatus('Archive selected');
              },
            },
          ]}
        />
        <Modal
          title="Rename show"
          description="Give this show a useful name."
          trigger={<Button variant="outline">Open dialog</Button>}
        >
          <AutoField label="Name">
            {(id) => <Input id={id} defaultValue="Bonfire Classic" />}
          </AutoField>
          <p className="text-muted-foreground text-xs">
            This demonstration does not save to a database.
          </p>
        </Modal>
        <Modal
          title="Filters"
          description="Choose which local notifications to show."
          side
          trigger={<Button variant="outline">Open sheet</Button>}
        >
          <p className="text-sm">Sheet content wraps at phone widths.</p>
        </Modal>
      </div>
      {status.length > 0 && (
        <p role="status" className="text-muted-foreground text-xs">
          {status}
        </p>
      )}
    </Example>
  );
}
