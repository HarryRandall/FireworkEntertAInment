/** Names the project's documented stakeholders without implying broader retailer coverage. */

import { Container } from '@/app/components/ui/Container';
import { Underline } from './landing/decor';

const STAKEHOLDERS = [
  'ICON Pyrotechnics International Co Ltd',
  'International Fireworks Pty Ltd',
] as const;

export function SocialProof() {
  return (
    <section className="pt-5 pb-10" aria-labelledby="project-stakeholders">
      <Container className="flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-1.5">
          <h2
            id="project-stakeholders"
            className="text-on-surface-variant text-center text-xs font-semibold tracking-[0.18em] uppercase"
          >
            Project stakeholders
          </h2>
          <Underline width={68} color="currentColor" className="text-on-surface-variant/45" />
        </div>
        <ul className="flex flex-wrap justify-center gap-3">
          {STAKEHOLDERS.map((stakeholder) => (
            <li
              key={stakeholder}
              className="border-outline-variant/40 bg-surface-container-low text-on-surface rounded-full border px-5 py-2.5 text-center text-sm font-bold tracking-[-0.01em]"
            >
              {stakeholder}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
