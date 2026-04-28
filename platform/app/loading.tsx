export default function Loading() {
  return (
    <div
      aria-label="Loading page"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-surface-container-high"
      role="status"
    >
      <div className="route-progress-bar h-full rounded-r-full bg-primary-container shadow-[0_0_18px_color-mix(in_srgb,var(--color-primary)_70%,transparent)]" />
    </div>
  );
}
