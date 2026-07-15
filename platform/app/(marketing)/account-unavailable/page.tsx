/** Safe landing page for signed-in accounts that cannot enter the workspace. */

import type { Metadata } from 'next';
import { CircleSlash2, Mail } from 'lucide-react';
import { SignOutButton } from '@/app/(app)/settings/SignOutButton';
import { Container } from '@/app/components/ui/Container';
import { Card } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';

export const metadata: Metadata = {
  title: 'Account unavailable · ShowCrafter',
  description: 'This account cannot currently access the ShowCrafter workspace.',
  robots: { index: false, follow: false },
};

export default function AccountUnavailablePage() {
  return (
    <main className="flex min-h-[70vh] items-center py-16 sm:py-24">
      <Container className="max-w-3xl">
        <Card radius="xl" elevation="high" className="p-7 sm:p-10">
          <span className="border-outline-variant bg-surface-container text-primary flex size-12 items-center justify-center rounded-2xl border">
            <CircleSlash2 aria-hidden size={22} />
          </span>
          <h1 className="text-on-surface mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            This account cannot access the workspace.
          </h1>
          <p className="text-on-surface-variant mt-4 max-w-2xl leading-relaxed text-pretty">
            The profile may be suspended or incomplete. Sign out to use another account, or email
            support if you believe access should be restored.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <SignOutButton />
            <Button
              href="mailto:support@showcrafter.app?subject=ShowCrafter%20account%20access"
              variant="secondary"
            >
              <Mail aria-hidden size={16} />
              Email support
            </Button>
          </div>
        </Card>
      </Container>
    </main>
  );
}
