/** The project's documented stakeholders, as a quiet row under the hero. */
const STAKEHOLDERS = [
  'ICON Pyrotechnics International Co Ltd',
  'International Fireworks Pty Ltd',
] as const;

export function LandingStakeholders() {
  return (
    <section aria-labelledby="stakeholders-heading" className="border-border border-b">
      <div className="border-border mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between sm:px-10 lg:border-x">
        <h2
          id="stakeholders-heading"
          className="text-muted-foreground font-mono text-[11px] tracking-wide uppercase"
        >
          Project stakeholders
        </h2>
        <ul className="flex flex-wrap justify-center gap-x-8 gap-y-2">
          {STAKEHOLDERS.map((stakeholder) => (
            <li key={stakeholder} className="text-foreground text-sm font-semibold tracking-tight">
              {stakeholder}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
