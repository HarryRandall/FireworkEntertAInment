/** Broad animated kit review, with a system reduced-motion explanation. */
import {
  AnimatedGradientText,
  BlurFade,
  BorderBeam,
  Marquee,
  ShimmerButton,
} from '@/ui/kit/motion';
import { NumberTicker } from '@/ui/kit/number-ticker';
import { Example, Group, State } from './example';

const TICKER_VALUE = 12400; // Synthetic scan-count fixture.
const wholeNumbers = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
/** Shows six decorative Magic UI adaptations with system reduced-motion support. */
export function MotionExamples() {
  return (
    <Group id="motion" title="Motion">
      <Example
        id="animated-kit"
        title="Animated kit"
        source="Magic UI · MIT"
        description="Shimmer, border beam, marquee, gradient text, blur reveal and number ticker. Every animation stops or becomes immediate with reduced motion."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <State label="Shimmer button">
            <ShimmerButton>Build a show</ShimmerButton>
            <ShimmerButton disabled>Disabled action</ShimmerButton>
          </State>
          <State label="Border beam">
            <BorderBeam>
              <b className="text-sm">Your next great show</b>
              <p className="text-muted-foreground mt-1 text-xs">
                A decorative accent around a card.
              </p>
            </BorderBeam>
          </State>
          <State label="Gradient text">
            <AnimatedGradientText>Watch before you buy</AnimatedGradientText>
          </State>
          <State label="Blur reveal">
            <BlurFade>
              <p className="text-sm">A gentle entrance for non-essential decoration.</p>
            </BlurFade>
          </State>
          <State label="Number ticker">
            <span className="text-3xl">
              <NumberTicker value={TICKER_VALUE} format={(value) => wholeNumbers.format(value)} />
            </span>
          </State>
        </div>
        <State label="Marquee">
          <Marquee items={['Peony', 'Golden willow', 'Crackling palm', 'Neutron twist']} />
        </State>
      </Example>
    </Group>
  );
}
