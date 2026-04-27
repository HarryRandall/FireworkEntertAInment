import Image from "next/image";
import { Container } from "@/app/components/ui/Container";
import { Button } from "@/app/components/ui/Button";

const BG_IMAGE_SRC =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCDcrWCiRT9ABdL1Ukd3QscBqyYbeULZI7ZtxaNJajOZEkoXaKs0rv6REjFFtKwtEtwcCvByS4iVzjuQDeVrolF5zs6Jyah5om4MxENwblpKL7dTBBOAur_3C7PkeBj_KevDy7jyaMX8UfoxRMVwK-hv5-krHMNiu9oPBIWxJ2-ZLWxWZu0a2fqdAreKGCig4UFqZ7g5jIlarTfhQAFVZZae9krY6ppag9kFI9Fb0_UL6T0050PpIYOe6pJ8uwtnDd6ePuycrTrQKI";

type CTABandProps = {
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
};

export function CTABand({
  title,
  description,
  primaryHref,
  primaryLabel,
}: CTABandProps) {
  return (
    <section className="py-24">
      <Container>
        <div className="relative overflow-hidden rounded-3xl border border-outline-variant/15 bg-surface-container-high p-12 text-center md:p-24">
          <Image
            src={BG_IMAGE_SRC}
            alt=""
            aria-hidden
            fill
            className="pointer-events-none object-cover opacity-10"
            unoptimized
          />
          <div className="relative z-10 mx-auto max-w-2xl space-y-6">
            <h2 className="text-4xl font-bold tracking-tight text-on-surface md:text-6xl">
              {title}
            </h2>
            <p className="text-lg text-on-surface-variant">{description}</p>
            <div className="pt-4">
              <Button href={primaryHref} size="lg">
                {primaryLabel}
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
