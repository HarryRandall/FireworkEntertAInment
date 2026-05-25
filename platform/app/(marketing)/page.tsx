/** Marketing homepage. */

import { Hero } from '@/app/components/marketing/Hero';
import { CTABand } from '@/app/components/marketing/CTABand';
import { InteractiveSteps } from '@/app/components/marketing/InteractiveSteps';
import { VendorNetwork } from '@/app/components/marketing/VendorNetwork';

export default function MarketingHome() {
  return (
    <>
      <Hero
        title="Design your own"
        highlight="fireworks show."
        subtitle="Pick a song, set a budget, and let AI choreograph the rest — using real products from your local store."
        primaryHref="/shows/new"
        primaryLabel="Create a Show"
        secondaryHref="#how-it-works"
        secondaryLabel="See how it works"
      />

      <InteractiveSteps />

      <VendorNetwork />

      <CTABand
        title="Ready to light up the sky?"
        description="Start your first choreography today. Free to design — buy only the products you need."
        primaryHref="/shows/new"
        primaryLabel="Start Choreographing"
      />
    </>
  );
}
