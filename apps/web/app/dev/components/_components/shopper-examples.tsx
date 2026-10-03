/** Shopper card, chat and printable label compositions using synthetic content. */
'use client';
import { useState } from 'react';
import { PlannedShowCard } from '@/ui/kit/show-card';
import { PrintLabel } from '@/ui/kit/print-label';
import { ChatBubble, ChatPrompt, TypingIndicator } from '@/ui/kit/chat';
import type { ProductChoice } from '@/ui/kit/product-picker';
import { Example, Group } from './example';
import fixtures from './gallery-fixtures.json';

// Prototype planned-show energy profile, normalised to the peak.
const energy = fixtures.energy;
function QrIllustration() {
  return (
    <svg
      viewBox="0 0 10 10"
      role="img"
      aria-label="Illustrative QR placeholder, not a scannable code"
      className="w-full"
    >
      <rect width="10" height="10" fill="white" />
      <path d="M1 1h3v3H1zM6 1h3v3H6zM1 6h3v3H1zM6 6h1v1H6zM8 6h1v3H8zM6 8h1v1H6z" fill="black" />
    </svg>
  );
}
/** Shows one planned show, local chat composition and three print sizes. */
export function ShopperExamples({ products }: { products: ProductChoice[] }) {
  const [selected, setSelected] = useState(true);
  const [request, setRequest] = useState('Can it be under £150 and a bit louder?');
  return (
    <Group id="shopper" title="Shopper">
      <Example
        id="show-card"
        title="Planned show card"
        source="ShowCrafter"
        description="One planned show with explicit selection, price, duration and energy profile."
      >
        <div className="max-w-sm">
          <PlannedShowCard
            title="Bonfire Classic"
            description="Big, warm and golden"
            price="£189"
            duration="4 min"
            itemCount={7}
            energy={energy}
            tags={['Best seller', 'Family']}
            poster={products[0]?.poster}
            posterError={products[0]?.posterError}
            selected={selected}
            onSelect={() => {
              setSelected(!selected);
            }}
          />
        </div>
      </Example>
      <Example
        id="chat"
        title="Change request chat"
        source="shadcn chat composition"
        description="Presentation only. Typed suggestions and replies stay local in this gallery."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-3">
            <ChatBubble from="user">{request}</ChatBubble>
            <ChatBubble
              from="assistant"
              changes={[
                { text: 'Kamuro Gold Rain £52', kind: 'removed' },
                { text: 'Crackle Mine £12.50', kind: 'added' },
                { text: 'Silver Dragon £22', kind: 'added' },
              ]}
            >
              Done. Bonfire Classic is now <b>£146</b>.
            </ChatBubble>
            <TypingIndicator />
          </div>
          <div className="content-end">
            <ChatPrompt
              onSubmit={setRequest}
              suggestions={['More crackle', 'Fewer rockets', 'Make it longer', 'Pet friendly']}
            />
          </div>
        </div>
      </Example>
      <Example
        id="labels"
        title="Shelf labels"
        source="ShowCrafter"
        description="Shelf strip, A6 counter card and A4 poster. QR artwork here is an illustration."
      >
        <div className="bg-muted flex flex-wrap items-end justify-center gap-6 rounded-lg p-4">
          <PrintLabel
            size="shelf"
            title="Neutron Emerald Twist"
            price="£34.99"
            description="Scan to watch it in 3D"
            qr={<QrIllustration />}
          />
          <PrintLabel
            size="card"
            title="Bonfire Classic"
            logo="HARTLEY FIREWORKS"
            price="£189"
            qr={<QrIllustration />}
          />
          <PrintLabel
            size="poster"
            title="Watch before you buy"
            logo="HARTLEY FIREWORKS"
            qr={<QrIllustration />}
          />
        </div>
      </Example>
    </Group>
  );
}
