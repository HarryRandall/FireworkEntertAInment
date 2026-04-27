"use client";

import { useRef, type ReactNode, type PointerEvent } from "react";
import { useReducedMotion } from "framer-motion";

type TiltCardProps = {
  children: ReactNode;
  className?: string;
  max?: number;
};

export function TiltCard({ children, className = "", max = 6 }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (reduce || e.pointerType === "touch") return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    // Disable the CSS transition while actively tracking the pointer so the
    // tilt follows the cursor 1:1 instead of chasing every move with a 200ms
    // interpolation (which made the cards feel laggy / jittery).
    el.style.transition = "none";
    el.style.transform = `perspective(1200px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg)`;
  }

  function onLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.transition = "";
    el.style.transform = "perspective(1200px) rotateX(0deg) rotateY(0deg)";
  }

  return (
    <div
      className={`tilt-card ${className}`}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <div ref={ref} className="tilt-card-inner h-full w-full">
        {children}
      </div>
    </div>
  );
}
