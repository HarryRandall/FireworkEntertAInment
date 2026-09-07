/** Show-local not-found state that keeps the authenticated workspace chrome visible. */

import { FileQuestion, List, Plus } from 'lucide-react';
import { Button } from '@/components/design-system/Button';
import { Card } from '@/components/design-system/Card';

export default function ShowNotFound() {
  return (
    <div className="mx-auto flex min-h-[calc(100svh-12rem)] w-full max-w-3xl items-center justify-center py-8">
      <Card radius="xl" className="w-full p-6 sm:p-10">
        <span className="bg-muted text-muted-foreground inline-flex size-11 items-center justify-center rounded-xl">
          <FileQuestion aria-hidden size={21} />
        </span>
        <p className="text-muted-foreground mt-6 text-xs font-semibold tracking-widest uppercase">
          Show not found
        </p>
        <h1 className="text-foreground mt-2 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          We could not open this show.
        </h1>
        <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed sm:text-base">
          It may have been removed, or it may not be available to this account. Return to your shows
          or start a new plan.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Button href="/shows">
            <List aria-hidden size={17} />
            Back to my shows
          </Button>
          <Button href="/shows/new" variant="secondary">
            <Plus aria-hidden size={17} />
            Create a show
          </Button>
        </div>
      </Card>
    </div>
  );
}
