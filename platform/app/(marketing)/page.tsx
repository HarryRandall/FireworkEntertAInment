/** Marketing homepage. */

import { Hero } from '@/app/components/marketing/Hero';
import { SocialProof } from '@/app/components/marketing/SocialProof';
import { Steps } from '@/app/components/marketing/Steps';
import { Showcase } from '@/app/components/marketing/Showcase';
import { Testimonials } from '@/app/components/marketing/Testimonials';
import { CTABand } from '@/app/components/marketing/CTABand';

export default function MarketingHome() {
  return (
    <>
      <Hero
        title="Design your own"
        highlight="fireworks show."
        subtitle="Pick a song, set a budget, and build a cue timeline from catalogue products. Preview the result and review the shopping list before finalising your plan."
        primaryHref="/shows/new"
        primaryLabel="Create a show"
        secondaryHref="#how-it-works"
        secondaryLabel="See how it works"
      />

      <SocialProof />

      <Steps />

      <Showcase />

      <Testimonials />

      <CTABand
        title="Ready to light up the sky?"
        description="Start on the Free plan, preview the cue sequence and review the products your show needs."
        primaryHref="/shows/new"
        primaryLabel="Create a show"
        secondaryHref="#showcase"
        secondaryLabel="Watch the renderer demo"
      />
    </>
  );
}
