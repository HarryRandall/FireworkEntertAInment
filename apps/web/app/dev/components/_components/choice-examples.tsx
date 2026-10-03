/** Choice-card and product-picker interactions for owner review. */
'use client';
import { useState } from 'react';
import { Sparkles, Upload, Store, List, Eye, ShoppingBag } from 'lucide-react';
import { RadioCards, CheckboxCards, Chips, Swatches } from '@/ui/kit/choices';
import { ProductPicker, type ProductChoice } from '@/ui/kit/product-picker';
import { Group, Example, State } from './example';

/** Prototype colour fixtures, independent of the interface palette. */
const swatches = [
  { colour: '#0f7a52', label: 'Green' },
  { colour: '#1f5fbf', label: 'Blue' },
  { colour: '#7c3aed', label: 'Purple' },
  { colour: '#c2410c', label: 'Orange' },
  { colour: '#be123c', label: 'Rose' },
  { colour: '#111111', label: 'Black' },
];
/** Shows selected, unselected and disabled card states with real 3D posters. */
export function ChoiceExamples({ products }: { products: ProductChoice[] }) {
  const [range, setRange] = useState('starter');
  const [labels, setLabels] = useState(['shelf', 'counter']);
  const [music, setMusic] = useState(['Pop']);
  const [colour, setColour] = useState(swatches[0].colour);
  return (
    <Group id="choices" title="Choices">
      <Example
        id="radio-cards"
        title="Radio cards"
        source="shadcn Radio Group"
        description="One answer with an explanation and full arrow-key navigation."
      >
        <RadioCards
          label="Starting range"
          value={range}
          onChange={setRange}
          items={[
            {
              value: 'starter',
              title: 'Start with a best-seller range',
              description: '8 popular products. Edit as you go.',
              icon: <Sparkles className="size-5" />,
            },
            {
              value: 'import',
              title: 'Import your stock list',
              description: 'CSV or Excel from your till',
              icon: <Upload className="size-5" />,
            },
            {
              value: 'disabled',
              title: 'Unavailable range',
              description: 'Disabled example',
              disabled: true,
            },
          ]}
        />
      </Example>
      <Example
        id="checkbox-cards"
        title="Checkbox tiles"
        source="shadcn Checkbox"
        description="Several independent answers in compact cards."
      >
        <CheckboxCards
          label="Label placements"
          value={labels}
          onChange={setLabels}
          items={[
            {
              value: 'shelf',
              title: 'Shelf strips',
              description: 'Under each price',
              icon: <List className="size-5" />,
            },
            {
              value: 'counter',
              title: 'Counter card',
              description: 'At the till',
              icon: <Store className="size-5" />,
            },
            {
              value: 'window',
              title: 'Window poster',
              description: 'Passers-by',
              icon: <Eye className="size-5" />,
            },
            {
              value: 'bag',
              title: 'Bag or receipt',
              description: 'Watch at home',
              icon: <ShoppingBag className="size-5" />,
            },
          ]}
        />
      </Example>
      <Example
        id="chips"
        title="Choice chips and swatches"
        source="shadcn Toggle Group + Radio Group"
        description="Multi-select tags and one labelled authored colour."
      >
        <Chips
          label="Music style"
          items={['Pop', 'Classical', 'Film scores', 'Rock', 'No music']}
          value={music}
          onChange={setMusic}
        />
        <Swatches label="Brand colour" items={swatches} value={colour} onChange={setColour} />
      </Example>
      <ProductExamples products={products} />
    </Group>
  );
}

function ProductExamples({ products }: { products: ProductChoice[] }) {
  const [picks, setPicks] = useState(['chrysanthemum']);
  return (
    <Example
      id="picker"
      title="Product picker"
      source="ShowCrafter poster + shadcn card pattern"
      description="3D stills use one shared poster surface, with selection by stable id."
    >
      <ProductPicker label="Products" items={products} selected={picks} onChange={setPicks} />
      <div className="grid gap-3 sm:grid-cols-2">
        <State label="Loading">
          <ProductPicker
            label="Loading products"
            items={[
              { id: 'pending', name: 'Preparing product', metadata: 'Cake', price: '£34.99' },
            ]}
            selected={[]}
            onChange={setPicks}
          />
        </State>
        <State label="Error and disabled">
          <ProductPicker
            label="Unavailable products"
            items={[
              {
                id: 'error',
                name: 'Unavailable poster',
                metadata: 'Rocket',
                price: '£12',
                posterError: 'Poster unavailable',
                disabled: true,
              },
            ]}
            selected={[]}
            onChange={setPicks}
          />
        </State>
      </div>
    </Example>
  );
}
