import type { Metadata } from "next";
import { ComingSoon } from "@/app/components/marketing/ComingSoon";

export const metadata: Metadata = {
  title: "Cookies · ShowCrafter",
  description: "Our cookie policy is being finalised.",
};

export default function CookiesPage() {
  return (
    <ComingSoon
      eyebrow="Cookie Policy"
      title="Cookie policy coming soon."
      description="We use a minimal set of cookies for authentication and session state. A detailed breakdown is coming with our full privacy policy."
    />
  );
}
