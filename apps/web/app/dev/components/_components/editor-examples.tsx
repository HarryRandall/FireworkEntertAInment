/** Renderer-compatible editor inputs with pointer and number-row examples. */
'use client';
import { useState } from 'react';
import { brightnessSchema, colourSchema } from '@showcrafter/fireworks/schema';
import fixtures from './gallery-fixtures.json';
import { CurveEditor } from '@/ui/kit/curve-editor';
import { GradientEditor } from '@/ui/kit/gradient-editor';
import { LayerList, type LayerItem } from '@/ui/kit/layer-list';
import { Example, Group, State } from './example';

// Authored prototype fixtures are validated at the same boundary as stored curves.
const brightness = brightnessSchema.parse(fixtures.brightness);
const spread = brightnessSchema.parse(fixtures.spread);
const colours = colourSchema.parse(fixtures.colours);
const layers: LayerItem[] = [
  { id: 'launch', name: 'Launch', badge: '2.4 s' },
  { id: 'break', name: 'Break 1', hasChildren: true, expanded: true, badge: '120 m' },
  { id: 'outer', name: 'Outer stars', depth: 1, colour: '#e5484d', badge: '96' },
  { id: 'pistil', name: 'Pistil', depth: 1, colour: '#30a46c', badge: '40' },
  { id: 'crackle', name: 'Crackle', depth: 1, colour: '#e9b949', badge: 'mod', hidden: true },
  { id: 'flash', name: 'Core flash', depth: 1, colour: '#ffffff' },
  { id: 'sound', name: 'Sound' },
];

/** Exercises graph, palette and layer editing with independent controlled state. */
export function EditorExamples() {
  const [curve, setCurve] = useState(brightness);
  const [spreadCurve, setSpread] = useState(spread);
  const [gradient, setGradient] = useState(colours);
  const [rows, setRows] = useState(layers);
  const [selected, setSelected] = useState('outer');
  const visible = rows.filter(
    (row) =>
      (row.depth ?? 0) === 0 || rows.find((parent) => parent.id === 'break')?.expanded === true,
  );
  return (
    <Group id="editor" title="Editor">
      <Example
        id="layers"
        title="Layer list"
        source="ShowCrafter layer tree"
        description="Select, expand and toggle preview visibility with separate keyboard controls."
      >
        <LayerList
          items={visible}
          selected={selected}
          onSelect={setSelected}
          onVisibilityChange={(id, shown) => {
            setRows(rows.map((row) => (row.id === id ? { ...row, hidden: !shown } : row)));
          }}
          onExpandedChange={(id, expanded) => {
            setRows(rows.map((row) => (row.id === id ? { ...row, expanded } : row)));
          }}
        />
      </Example>
      <Example
        id="curve"
        title="Curve editor"
        source="Shared renderer brightness maths"
        description="Drag keys or edit their numbers. Life is normalised, endpoints are pinned in time, and the preview uses actual renderer interpolation."
      >
        <div className="grid gap-8 sm:grid-cols-2">
          <State label="Brightness over life">
            <CurveEditor label="Brightness over life" value={curve} onChange={setCurve} />
          </State>
          <State label="Spread over time">
            <CurveEditor label="Spread over time" value={spreadCurve} onChange={setSpread} />
          </State>
          <State label="Disabled">
            <CurveEditor label="Disabled curve" value={brightness} onChange={setCurve} disabled />
          </State>
        </div>
      </Example>
      <Example
        id="gradient"
        title="Colour over time"
        source="Shared renderer linear-RGB maths"
        description="Drag stops or edit times and colours. The preview samples linear RGB exactly like the renderer."
      >
        <GradientEditor label="Colour over life" value={gradient} onChange={setGradient} />
        <State label="Disabled">
          <GradientEditor
            label="Disabled gradient"
            value={colours}
            onChange={setGradient}
            disabled
          />
        </State>
      </Example>
    </Group>
  );
}
