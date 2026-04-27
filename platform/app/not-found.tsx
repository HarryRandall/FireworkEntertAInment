import { Home } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Container } from "@/app/components/ui/Container";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
      {/* Ember glow backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="w-[600px] h-[600px] rounded-full bg-primary/10 blur-[140px]" />
      </div>

      {/* Floating sparks */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {[
          { top: "18%", left: "12%", size: 3, opacity: 0.35 },
          { top: "72%", left: "8%", size: 2, opacity: 0.25 },
          { top: "35%", left: "88%", size: 4, opacity: 0.30 },
          { top: "80%", left: "82%", size: 2, opacity: 0.20 },
          { top: "55%", left: "50%", size: 3, opacity: 0.15 },
          { top: "10%", left: "60%", size: 2, opacity: 0.25 },
        ].map((spark, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-primary animate-pulse"
            style={{
              top: spark.top,
              left: spark.left,
              width: spark.size,
              height: spark.size,
              opacity: spark.opacity,
              animationDelay: `${i * 0.4}s`,
              animationDuration: `${2.5 + i * 0.3}s`,
            }}
          />
        ))}
      </div>

      <Container className="relative z-10 flex flex-col items-center text-center gap-8 py-24">
        {/* Eyebrow */}
        <p className="text-xs uppercase tracking-widest font-bold text-on-surface-variant">
          Error 404
        </p>

        {/* Headline */}
        <div className="flex flex-col gap-3">
          <h1 className="text-[clamp(72px,14vw,140px)] font-extrabold leading-none tracking-tighter text-on-surface tabular-nums select-none">
            4<span className="text-primary">0</span>4
          </h1>
          <p className="text-xl md:text-2xl font-semibold text-on-surface leading-snug">
            This shell misfired.
          </p>
        </div>

        {/* Body */}
        <p className="max-w-md text-base text-on-surface-variant leading-relaxed">
          The page you're looking for doesn't exist — or it's been moved to a
          different part of the show. Head back and pick up where you left off.
        </p>

        {/* Divider spark line */}
        <div className="w-16 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

        {/* Actions */}
        <Button href="/" size="lg">
          <Home size={18} strokeWidth={1.75} />
          Return Home
        </Button>
      </Container>
    </div>
  );
}
