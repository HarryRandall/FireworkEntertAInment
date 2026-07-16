/** Keyboard shortcut past repeated navigation and shell chrome. */
export function SkipLink({ href = '#main-content' }: { href?: string }) {
  return (
    <a
      href={href}
      className="bg-background text-foreground focus-visible:ring-ring fixed top-3 left-3 z-[100] -translate-y-20 rounded-md px-4 py-2 text-sm font-semibold shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus-visible:ring-2"
    >
      Skip to main content
    </a>
  );
}
