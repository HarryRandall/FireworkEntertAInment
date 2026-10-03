/** Interactive field examples covering validation, disabled and edited states. */
'use client';
import { useState } from 'react';
import { Copy, Search } from 'lucide-react';
import { Input, Select, Textarea } from '@/ui/primitives/input';
import { Button } from '@/ui/primitives/button';
import { AutoField, Field, InputGroup } from '@/ui/kit/field';
import { TagInput } from '@/ui/kit/tag-input';
import { Slider, NumberStepper } from '@/ui/kit/number-controls';
import { SegmentedControl, Switch } from '@/ui/kit/segmented-control';
import { FileUpload } from '@/ui/kit/file-upload';
import { Kbd } from '@/ui/kit/shortcuts';
import { Example, Group, State } from './example';

const MAX_COPIES = 20; // Prototype number-control fixture bound.
const MIN_BUDGET = 50; // Prototype budget fixture, GBP.
const MAX_BUDGET = 400;
const INITIAL_BUDGET = 190;
const BUDGET_STEP = 10;
const INITIAL_BURST = 60; // Percentage fixture from the prototype.
const PERCENT_MAX = 100;
const UPLOAD_MIB = 10; // Prototype upload capacity, MiB.
const BYTES_PER_MIB = 1048576; // Binary mebibyte definition.
const UPLOAD_BYTES = UPLOAD_MIB * BYTES_PER_MIB; // Prototype upload limit, ten MiB.

/** Shows the prototype's field, number, selection and upload families. */
export function FormExamples() {
  return (
    <Group id="forms" title="Forms">
      <TextExamples />
      <TagExamples />
      <NumberExamples />
      <PreferenceExamples />
      <UploadExamples />
    </Group>
  );
}
function TextExamples() {
  return (
    <>
      <FieldExamples />
      <InputGroupExamples />
      <SelectExamples />
    </>
  );
}
function TagExamples() {
  const [emails, setEmails] = useState(['sam@hartley.co.uk', 'jo@hartley.co.uk', 'not-an-email']);
  const [tags, setTags] = useState(['crackle', 'gold', 'low noise']);
  return (
    <Example
      id="tags"
      title="Tag input"
      source="shadcn Input + Badge composition"
      description="Paste a list or press Enter, comma, semicolon or space. Invalid emails stay visible."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <AutoField label="Invite by email">
          {(id) => (
            <TagInput
              id={id}
              label="Add invitation emails"
              value={emails}
              onChange={setEmails}
              email
              placeholder="Add emails"
            />
          )}
        </AutoField>
        <AutoField label="Keywords">
          {(id) => <TagInput id={id} label="Add keywords" value={tags} onChange={setTags} />}
        </AutoField>
        <TagInput
          id="disabled-tags"
          label="Disabled tags"
          value={['gold']}
          onChange={setTags}
          disabled
        />
      </div>
    </Example>
  );
}
function NumberExamples() {
  const [budget, setBudget] = useState(INITIAL_BUDGET);
  const [burst, setBurst] = useState(INITIAL_BURST);
  const [copies, setCopies] = useState(2);
  return (
    <Example
      id="numbers"
      title="Sliders and steppers"
      source="shadcn Slider + bounded input"
      description="Live ranges, bounded quantities and disabled controls."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Slider
          label="Budget"
          value={budget}
          onChange={setBudget}
          min={MIN_BUDGET}
          max={MAX_BUDGET}
          step={BUDGET_STEP}
          format={(value) => `£${String(value)}`}
          ticks={['£50', '£150', '£250', '£400']}
        />
        <Slider
          label="Burst size"
          value={burst}
          onChange={setBurst}
          min={0}
          max={PERCENT_MAX}
          format={(value) => `${String(value)}%`}
        />
        <State label="Copies per store">
          <NumberStepper
            label="copies per store"
            value={copies}
            min={1}
            max={MAX_COPIES}
            onChange={setCopies}
          />
        </State>
        <State label="Disabled">
          <NumberStepper
            label="disabled quantity"
            value={2}
            min={1}
            max={MAX_COPIES}
            onChange={setCopies}
            disabled
          />
        </State>
      </div>
    </Example>
  );
}
function PreferenceExamples() {
  const [enabled, setEnabled] = useState(true);
  const [filter, setFilter] = useState('Scans');
  return (
    <Example
      id="switch"
      title="Switch and segmented control"
      source="shadcn Switch + Toggle Group"
      description="One on/off preference and a single local filter."
    >
      <div className="flex flex-wrap items-center gap-5">
        <Switch label="Enable notifications" checked={enabled} onChange={setEnabled} />
        <Switch label="Disabled preference" checked={false} onChange={setEnabled} disabled />
        <SegmentedControl
          label="Activity type"
          items={['All', 'Scans', 'Plays', 'List adds']}
          value={filter}
          onChange={setFilter}
        />
      </div>
    </Example>
  );
}
function UploadExamples() {
  const [file, setFile] = useState<File | null>(null);
  return (
    <Example
      id="upload"
      title="File upload"
      source="ReUI use-file-upload"
      description="Drop or browse. Unsupported or oversized files leave the current selection intact."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <FileUpload
          label="Drop your stock list"
          hint="CSV or XLSX, up to 10 MiB"
          accept=".csv,.xlsx"
          maxBytes={UPLOAD_BYTES}
          value={file}
          onChange={setFile}
        />
        <FileUpload
          label="Disabled upload"
          hint="Unavailable while saving"
          accept=".csv"
          maxBytes={UPLOAD_BYTES}
          value={null}
          onChange={setFile}
          disabled
        />
      </div>
    </Example>
  );
}

function FieldExamples() {
  return (
    <Example
      id="fields"
      title="Text field"
      source="shadcn Input + Label"
      description="Label above, help or error below. Optional fields say so."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <State label="Default">
          <AutoField label="Business name" help="Shown on labels and your shopper page.">
            {(id, description) => (
              <Input id={id} aria-describedby={description} defaultValue="Hartley Fireworks" />
            )}
          </AutoField>
        </State>
        <State label="Optional">
          <Field id="website" label="Website" optional>
            <Input id="website" placeholder="hartleyfireworks.co.uk" />
          </Field>
        </State>
        <State label="Error">
          <Field
            id="email-error"
            label="Email"
            error="Enter a full email address, like name@example.com"
          >
            <Input
              id="email-error"
              defaultValue="sam@hartley"
              aria-invalid="true"
              aria-describedby="email-error-help"
            />
          </Field>
        </State>
        <State label="Disabled">
          <AutoField label="Store ID" help="Set by ShowCrafter.">
            {(id, description) => (
              <Input id={id} aria-describedby={description} value="st_8Fq2kd" disabled />
            )}
          </AutoField>
        </State>
      </div>
    </Example>
  );
}

function InputGroupExamples() {
  const [copied, setCopied] = useState(false);
  return (
    <Example
      id="input-group"
      title="Input group"
      source="shadcn Input Group"
      description="Currency, units, links and search addons."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <AutoField label="Price">
          {(id) => (
            <InputGroup id={id} prefix="£" suffix="GBP" inputMode="decimal" defaultValue="34.99" />
          )}
        </AutoField>
        <AutoField label="Short link">
          {(id) => (
            <InputGroup
              id={id}
              prefix="scft.co/"
              defaultValue="hartley-bonfire"
              suffix={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Copy short link"
                  onClick={() => {
                    navigator.clipboard
                      .writeText('scft.co/hartley-bonfire')
                      .then(() => {
                        setCopied(true);
                      })
                      .catch((error: unknown) => {
                        console.error('Copy failed', error);
                        setCopied(false);
                      });
                  }}
                >
                  <Copy />
                </Button>
              }
            />
          )}
        </AutoField>
        <AutoField label="Search">
          {(id) => (
            <InputGroup
              id={id}
              prefix={<Search className="size-4" />}
              suffix={<Kbd>⌘K</Kbd>}
              placeholder="Search products"
            />
          )}
        </AutoField>
        <AutoField label="Height">
          {(id) => <InputGroup id={id} suffix="m" inputMode="numeric" defaultValue="120" />}
        </AutoField>
      </div>
      {copied && (
        <p role="status" className="text-highlight-foreground text-xs">
          Copied short link
        </p>
      )}
    </Example>
  );
}

function SelectExamples() {
  return (
    <Example
      id="select"
      title="Select and textarea"
      source="shadcn Native Select + Textarea"
      description="Native keyboard selection and resizable, labelled text."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <AutoField label="Region">
          {(id) => (
            <Select id={id} defaultValue="England">
              {['England', 'Scotland', 'Wales', 'Northern Ireland'].map((region) => (
                <option key={region}>{region}</option>
              ))}
            </Select>
          )}
        </AutoField>
        <AutoField label="Welcome message" help="Shown on the shopper page.">
          {(id, description) => (
            <Textarea
              id={id}
              aria-describedby={description}
              defaultValue="Watch every firework before you buy."
              rows={2}
            />
          )}
        </AutoField>
      </div>
    </Example>
  );
}
