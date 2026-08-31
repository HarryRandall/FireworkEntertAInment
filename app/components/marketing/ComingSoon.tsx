/** Shared public placeholder for content that is not ready to publish. */

import { Clock3 } from 'lucide-react';
import { PageHeader } from '@/app/components/marketing/PageHeader';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Container } from '@/app/components/ui/Container';
import { Eyebrow } from '@/app/components/ui/Badge';

type ComingSoonProps = {
  eyebrow?: string;
  title: string;
  description: string;
};

export function ComingSoon({ eyebrow = 'Beta information', title, description }: ComingSoonProps) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} subtitle={description} />

      <section className="py-20 sm:py-24">
        <Container className="max-w-3xl">
          <Card radius="xl" shadow className="p-7 sm:p-9">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <span className="bg-primary/15 text-primary flex size-12 shrink-0 items-center justify-center rounded-2xl">
                <Clock3 aria-hidden="true" size={22} strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <Eyebrow>Current status</Eyebrow>
                <h2 className="text-on-surface mt-2 text-2xl font-bold tracking-tight text-balance">
                  This page is intentionally unavailable.
                </h2>
                <p className="text-on-surface-variant mt-3 leading-relaxed text-pretty">
                  The route remains visible so its status is clear, but its content will not be
                  presented as complete until it has been checked and approved for public use.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Button href="/">Return home</Button>
                  <Button href="/catalogue" variant="secondary">
                    Browse catalogue
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </Container>
      </section>
    </>
  );
}
