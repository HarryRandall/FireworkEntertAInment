/** Marketing homepage. */

import { Hero } from '@/app/components/marketing/Hero';
import { SocialProof } from '@/app/components/marketing/SocialProof';
import { Steps } from '@/app/components/marketing/Steps';
import { Showcase } from '@/app/components/marketing/Showcase';
import { VendorBand } from '@/app/components/marketing/VendorBand';
import { Testimonials } from '@/app/components/marketing/Testimonials';
import { CTABand } from '@/app/components/marketing/CTABand';

export default function MarketingHome() {
  return (
    <>
      <Hero
        title="Design your own"
        highlight="fireworks show."
        subtitle="Pick a song, set a budget, and let AI choreograph the rest — using real products from your local store. No pyro experience required."
        primaryHref="/shows/new"
        primaryLabel="Create a show"
        secondaryHref="#how-it-works"
        secondaryLabel="See how it works"
      />

      <SocialProof />

      <Steps />

      <Showcase />

      <VendorBand />

      <Testimonials />

      <CTABand
        title="Ready to light up the sky?"
        description="Start your first choreography today. Free to design — buy only the products you need."
        primaryHref="/shows/new"
        primaryLabel="Create a show"
        secondaryHref="#showcase"
        secondaryLabel="See a live show"
      />
    </>
  );
}
