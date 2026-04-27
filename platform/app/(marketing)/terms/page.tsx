import type { Metadata } from "next";
import { ComingSoon } from "@/app/components/marketing/ComingSoon";

export const metadata: Metadata = {
  title: "Terms · ShowCrafter",
  description: "Our terms of service are being finalised.",
};

export default function TermsPage() {
  return (
    <ComingSoon
      eyebrow="Terms of Service"
      title="Terms of service coming soon."
      description="The terms governing your use of ShowCrafter are being finalised with our legal team. Until then, the existing ICON Pyrotechnics retail terms apply to any purchase you make through us."
    />
  );
}
