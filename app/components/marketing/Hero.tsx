import Image from "next/image";
import { PlayCircle } from "lucide-react";
import { Container } from "@/app/components/ui/Container";
import { Button } from "@/app/components/ui/Button";

const HERO_IMAGE_SRC =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCV3GeixhWhXsweRzZPSZEOF9694HlgBguwnT3bJt5OrabCyX01ONVLqHoae-c3PTmGgYINDD8xRA5D_6nQLaY_fUHwGEEJ6R1nws9gieCjzR12DoG-8xyZISTF6ly7OHt00thNq2s-zNhSsKwnh4bw_kAjxwDx08o9QweFLQ7l0CGvilpy-1ZPP2tQq6L18K_8pTC0QRWeNtJsJH1D97T-PksB6tpuip0p6I05QeZnLE1l9cfZ1s8giePORf5o7--dHNppG1FOa-4";

type HeroProps = {
  title: string;
  highlight: string;
  subtitle: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  showName?: string;
  showProgressLabel?: string;
};

export function Hero({
  title,
  highlight,
  subtitle,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  showName = "Midnight Symphony 04",
  showProgressLabel = "02:44",
}: HeroProps) {
  return (
    <section className="relative overflow-hidden bg-background pb-16 pt-32 lg:pt-40">
      {/* Hero glow */}
      <div className="pointer-events-none absolute inset-0 -z-0">
        <div className="hero-glow absolute left-1/2 top-1/3 h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2" />
      </div>

      <Container className="relative z-10 flex flex-col items-center text-center">
        <h1 className="max-w-4xl text-5xl font-extrabold leading-[1.05] tracking-tight text-on-surface md:text-6xl lg:text-7xl">
          {title}{" "}
          <span className="text-primary">{highlight}</span>
        </h1>
        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-on-surface-variant md:text-xl">
          {subtitle}
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button href={primaryHref} size="lg">
            {primaryLabel}
          </Button>
          {secondaryHref ? (
            <Button href={secondaryHref} size="lg" variant="secondary">
              {secondaryLabel}
              <PlayCircle size={20} />
            </Button>
          ) : null}
        </div>

        <div className="relative mt-20 aspect-video w-full max-w-5xl overflow-hidden rounded-3xl border border-outline-variant/15 bg-surface-container-low shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]">
          <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
          <Image
            src={HERO_IMAGE_SRC}
            alt="Long-exposure photograph of golden and red fireworks against a deep night sky"
            fill
            sizes="(min-width: 1024px) 1024px, 100vw"
            className="object-cover opacity-60"
            priority
            unoptimized
          />
          <div className="absolute inset-x-6 bottom-6 flex items-end justify-between gap-4 sm:inset-x-8 sm:bottom-8">
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                Live Preview
              </div>
              <div className="text-xl font-medium md:text-2xl">{showName}</div>
            </div>
            <div className="hidden h-12 w-48 items-center gap-3 rounded-lg border border-outline-variant/10 bg-surface-container-high/80 px-4 backdrop-blur-md sm:flex">
              <div className="h-1 w-full overflow-hidden rounded-full bg-surface-container-highest">
                <div className="h-full w-2/3 bg-tertiary" />
              </div>
              <span className="font-mono text-[10px] tabular-nums text-tertiary">
                {showProgressLabel}
              </span>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
