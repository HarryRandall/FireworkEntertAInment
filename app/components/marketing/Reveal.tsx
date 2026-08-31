'use client';

/**
 * Reveal — subtle scroll-in animation for marketing sections. Content is
 * server-rendered visible; only elements that start below the fold are
 * softened out and lifted in as they enter the viewport. Respects
 * prefers-reduced-motion and never hides content without JavaScript.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type RevealProps = {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
};

export function Reveal({ children, delay = 0, y = 16, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<'static' | 'hidden' | 'shown'>('static');

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Anything already on screen (or close to it) stays visible; only
    // below-the-fold content gets the entrance animation.
    if (node.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    setPhase('hidden');
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPhase('shown');
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        className,
        phase !== 'static' && 'transition-[opacity,transform] duration-700 ease-out',
      )}
      style={
        phase === 'static'
          ? undefined
          : {
              opacity: phase === 'hidden' ? 0 : 1,
              transform: phase === 'hidden' ? `translateY(${y}px)` : 'translateY(0)',
              transitionDelay: `${delay}s`,
            }
      }
    >
      {children}
    </div>
  );
}
