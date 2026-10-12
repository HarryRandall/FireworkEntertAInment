/** Scroll-triggered entrances: Rise children hold their first frame until their Reveal is seen. */
'use client';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';

/** True once the element has scrolled into view, and from then on. */
function useEntered<T extends Element>(immediate: boolean) {
  const ref = useRef<T>(null);
  const [entered, setEntered] = useState(immediate);
  useEffect(() => {
    const element = ref.current;
    if (entered || !element) return;
    if (typeof IntersectionObserver === 'undefined') {
      setEntered(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setEntered(true);
          observer.disconnect();
        }
      },
      // Start slightly before the section is fully on screen.
      { rootMargin: '0px 0px -12% 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [entered]);
  return [ref, entered] as const;
}

/**
 * Starts the Rise entrances inside it once it scrolls into view. `immediate` plays them from
 * the server HTML, for content on screen as the page opens. Without scripting the
 * entrances are skipped (see kit.css).
 */
export function Reveal({
  children,
  className,
  immediate = false,
  as: Component = 'div',
  ...props
}: {
  children: ReactNode;
  className?: string;
  immediate?: boolean;
  as?: ElementType;
  id?: string;
  'aria-labelledby'?: string;
}) {
  const [ref, entered] = useEntered<HTMLElement>(immediate);
  return (
    <Component ref={ref} className={className} data-entered={entered || undefined} {...props}>
      {children}
    </Component>
  );
}

/** One entrance inside a Reveal, delayed by `delay` milliseconds for a stagger. */
export function Rise({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('sc-rise', className)}
      style={{ '--sc-delay': `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
