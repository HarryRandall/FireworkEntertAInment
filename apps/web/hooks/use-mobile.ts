import * as React from 'react';

// Shared responsive boundary from the component kit, CSS pixels.
const MOBILE_BREAKPOINT = 768;

/** Tracks whether the browser width is below the shared mobile breakpoint. */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${String(MOBILE_BREAKPOINT - 1)}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener('change', onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => {
      mql.removeEventListener('change', onChange);
    };
  }, []);

  return isMobile === true;
}
