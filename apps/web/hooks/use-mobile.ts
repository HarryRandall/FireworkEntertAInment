import * as React from 'react';

/** CSS pixels: Tailwind md is the default sheet boundary; admin uses sm for phones. */
const MOBILE_BREAKPOINT_PX = 768;

export function useIsMobile(breakpointPx = MOBILE_BREAKPOINT_PX) {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const onChange = () => {
      setIsMobile(mql.matches);
    };
    mql.addEventListener('change', onChange);
    setIsMobile(mql.matches);
    return () => mql.removeEventListener('change', onChange);
  }, [breakpointPx]);

  return !!isMobile;
}
