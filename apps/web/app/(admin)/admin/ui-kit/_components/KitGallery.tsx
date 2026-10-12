'use client';

import { useState, type ReactNode } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { ChatBubble, ChatPrompt, TypingIndicator } from '@/ui/kit/chat';
import { GridBackground } from '@/ui/kit/grid-background';
import {
  AnimatedGradientText,
  BlurFade,
  BorderBeam,
  Marquee,
  ShimmerButton,
  ShimmerLink,
} from '@/ui/kit/motion';
import { NumberTicker } from '@/ui/kit/number-ticker';
import { Reveal, Rise } from '@/ui/kit/reveal';
import { PlannedShowCard, PosterImage } from '@/ui/kit/show-card';
import { SpotlightCard } from '@/ui/kit/spotlight-card';

const EFFECTS = ['Peony', 'Chrysanthemum', 'Willow', 'Crossette', 'Dahlia', 'Comet', 'Strobe'];
const ENERGY = [0.3, 0.4, 0.5, 0.45, 0.6, 0.7, 0.55, 0.75, 0.8, 1, 0.95, 0.6];

function Example({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-border bg-card grid gap-4 rounded-xl border p-5">
      <h2 className="text-muted-foreground font-mono text-[11px] tracking-wide uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Every UI kit component with example data, so changes can be checked in one place. */
export function KitGallery() {
  const [messages, setMessages] = useState<string[]>([]);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Example title="Shimmer actions">
        <div className="flex flex-wrap items-center gap-3">
          <ShimmerButton>
            <Sparkles aria-hidden size={16} />
            Generate show
          </ShimmerButton>
          <ShimmerLink href="/admin">
            Back to overview
            <ArrowRight aria-hidden size={16} />
          </ShimmerLink>
        </div>
      </Example>

      <Example title="Animated gradient text and blur fade">
        <BlurFade delay={120}>
          <p className="text-foreground text-3xl font-semibold tracking-tight">
            Light up the <AnimatedGradientText>night sky</AnimatedGradientText>.
          </p>
        </BlurFade>
      </Example>

      <Example title="Border beam">
        <BorderBeam className="p-6">
          <p className="text-sm">A traced border for the one panel that should draw the eye.</p>
        </BorderBeam>
      </Example>

      <Example title="Number ticker">
        <p className="text-foreground text-4xl font-semibold">
          <NumberTicker value={104} />
        </p>
      </Example>

      <Example title="Marquee">
        <Marquee
          label="effect names"
          items={EFFECTS.map((name) => ({
            key: name,
            node: (
              <span className="border-border bg-background rounded-full border px-3 py-1 text-sm">
                {name}
              </span>
            ),
          }))}
        />
      </Example>

      <Example title="Spotlight card">
        <SpotlightCard className="border-border rounded-xl border p-6">
          <p className="text-sm font-medium">Move a mouse over this card.</p>
          <p className="text-muted-foreground mt-1 text-sm">The glow follows the pointer.</p>
        </SpotlightCard>
      </Example>

      <Example title="Grid background">
        <div className="border-border relative isolate h-48 overflow-hidden rounded-lg border">
          <GridBackground />
          <p className="relative p-4 text-sm">Flickering cells and a pointer spotlight.</p>
        </div>
      </Example>

      <Example title="Reveal and rise">
        <Reveal className="grid gap-2">
          {['Describe the show', 'Pick a song', 'Preview the cues'].map((step, index) => (
            <Rise key={step} delay={index * 90}>
              <div className="bg-muted rounded-md px-3 py-2 text-sm">{step}</div>
            </Rise>
          ))}
        </Reveal>
      </Example>

      <Example title="Chat">
        <div className="grid gap-2">
          <ChatBubble from="user">A three-minute New Year show for about £500.</ChatBubble>
          <ChatBubble from="assistant">Here is a plan with a gold finale.</ChatBubble>
          {messages.map((message, index) => (
            <ChatBubble key={`${message}-${index}`} from="user">
              {message}
            </ChatBubble>
          ))}
          <TypingIndicator />
          <ChatPrompt
            suggestions={['Make the finale longer', 'Add more willows']}
            onSubmit={(text) => setMessages((current) => [...current, text])}
          />
        </div>
      </Example>

      <Example title="Planned show card and poster states">
        <div className="grid gap-3 sm:grid-cols-2">
          <PlannedShowCard
            title="Gold Finale"
            description="Rising peonies into a willow and crackle finale."
            price="£480"
            duration="3:00"
            itemCount={12}
            energy={ENERGY}
            tags={['New Year', 'Large garden']}
            poster={<PosterImage />}
          />
          <div className="grid content-start gap-3">
            <PosterImage error="Preview unavailable" />
          </div>
        </div>
      </Example>
    </div>
  );
}
