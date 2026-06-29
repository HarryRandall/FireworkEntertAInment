'use client';

import { Component as NeatGradientCanvas } from '@/components/ui/neat-gradient';

export function GradientGridPreview() {
  return (
    <main className="relative min-h-[calc(100svh-49px)] overflow-hidden bg-[#003fff]">
      <NeatGradientCanvas className="absolute inset-0 h-full w-full" />
    </main>
  );
}
