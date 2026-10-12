/** Marketing homepage: real product surfaces rather than illustrations, from the live show down. */

import { CTABand } from '@/ui/marketing/CTABand';
import { CuratedEffects } from '@/ui/marketing/landing/CuratedEffects';
import { LandingAssortments } from '@/ui/marketing/landing/LandingAssortments';
import { LandingHero } from '@/ui/marketing/landing/LandingHero';
import { LandingStakeholders } from '@/ui/marketing/landing/LandingStakeholders';
import { LandingStarts } from '@/ui/marketing/landing/LandingStarts';
import { MultishotShowcase } from '@/ui/marketing/landing/MultishotShowcase';
import { SongToShow } from '@/ui/marketing/landing/SongToShow';

export default function MarketingHome() {
  return (
    <>
      <LandingHero />
      <LandingStakeholders />
      <CuratedEffects />
      <MultishotShowcase />
      <LandingAssortments />
      <SongToShow />
      <LandingStarts />
      <CTABand
        title="Ready to light up the sky?"
        description="Start on the Free plan, preview every cue in 3D and review the products your show needs."
        primaryHref="/shows/new"
        primaryLabel="Create a show"
        secondaryHref="/library"
        secondaryLabel="Explore templates"
      />
    </>
  );
}
