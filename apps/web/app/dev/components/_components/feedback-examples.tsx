/** Feedback, badges, team avatars and toast review states. */
'use client';
import { useState } from 'react';
import { MoreHorizontal, Plus } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { Badge, Callout, EmptyState, Progress, Skeleton, Spinner } from '@/ui/kit/feedback';
import { AvatarStack } from '@/ui/kit/avatars';
import { Kbd } from '@/ui/kit/shortcuts';
import { Example, Group, State } from './example';

const MATCH_PERCENT = 64; // Prototype matching progress fixture, percent.
/** Exercises button variants, each feedback tone, empty states and live toast dismissal. */
export function FeedbackExamples() {
  const [toast, setToast] = useState(false);
  return (
    <Group id="feedback" title="Feedback">
      <ButtonExamples />
      <CalloutExamples />
      <Example
        id="loading"
        title="Loading and toast"
        source="shadcn Progress + Skeleton"
        description="Status is readable with reduced motion; a toast is announced and dismissible."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <State label="Progress">
            <Progress label="Matching stock lines" value={MATCH_PERCENT} />
            <span className="text-muted-foreground text-xs">Matching 64 of 100 lines</span>
          </State>
          <State label="Spinner">
            <Spinner label="Planning your show" />
          </State>
          <State label="Skeleton">
            <Skeleton className="h-24" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </State>
          <State label="Toast">
            <Button
              variant="outline"
              onClick={() => {
                setToast(true);
              }}
            >
              Show a toast
            </Button>
            {toast && (
              <div
                role="status"
                className="border-border bg-card shadow-card flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                Show saved
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setToast(false);
                  }}
                >
                  Dismiss
                </Button>
              </div>
            )}
          </State>
        </div>
      </Example>
      <EmptyExamples />
      <Example
        id="badges"
        title="Badges, keys and avatars"
        source="shadcn Badge + Kbd + Avatar"
        description="Small status labels and fallback initials."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="success">Live</Badge>
          <Badge>Draft</Badge>
          <Badge tone="warning">Low stock</Badge>
          <Badge tone="danger">Failed</Badge>
          <Badge tone="info">New</Badge>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
          <AvatarStack
            people={[
              { name: 'Sam', initials: 'SH' },
              { name: 'Jo', initials: 'JW' },
              { name: 'Alex', initials: 'AT' },
            ]}
          />
        </div>
      </Example>
    </Group>
  );
}

function ButtonExamples() {
  return (
    <Example
      id="buttons"
      title="Buttons"
      source="shadcn Button"
      description="Primary for the main action, outline for secondary actions, ghost inside toolbars."
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button>
          <Plus />
          New show
        </Button>
        <Button variant="outline">Export</Button>
        <Button variant="ghost">Cancel</Button>
        <Button variant="outline" size="icon" aria-label="More actions">
          <MoreHorizontal />
        </Button>
        <Button size="lg">Continue</Button>
        <Button disabled>Disabled</Button>
        <Button disabled>
          <Spinner label="Saving" />
        </Button>
        <Button variant="destructive">Archive</Button>
      </div>
    </Example>
  );
}

function CalloutExamples() {
  return (
    <Example
      id="callouts"
      title="Callouts"
      source="shadcn Alert"
      description="Information, warning, success and error states with room for an action."
    >
      <Callout title="Watch before you buy" tone="info">
        Every product has a 3D preview.
      </Callout>
      <Callout title="Stock is running low" tone="warning">
        Three items need attention.
      </Callout>
      <Callout title="Your range is ready" tone="success">
        Products are available to preview.
      </Callout>
      <Callout
        title="Import failed"
        tone="danger"
        action={
          <Button variant="outline" size="sm">
            Retry
          </Button>
        }
      >
        Check your file and try again.
      </Callout>
    </Example>
  );
}

function EmptyExamples() {
  return (
    <Example
      id="empty"
      title="Empty and error states"
      source="shadcn Empty"
      description="Explain what happened and give one next action."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <EmptyState title="No shows yet" action={<Button size="sm">New show</Button>}>
          Create your first show to get started.
        </EmptyState>
        <EmptyState
          title="Couldn't load products"
          action={
            <Button variant="outline" size="sm">
              Try again
            </Button>
          }
        >
          Your current edits are safe.
        </EmptyState>
      </div>
    </Example>
  );
}
