"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Container } from "@/app/components/ui/Container";
import { Button } from "@/app/components/ui/Button";
import { createClient } from "@/utils/supabase/client";

type AppNavLink = { href: string; label: string };

const APP_LINKS: AppNavLink[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/shows/new", label: "New Show" },
];

type AppShellProps = {
  children: ReactNode;
  containerWidth?: "default" | "wide";
};

export function AppShell({ children, containerWidth = "default" }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-on-surface">
      <header className="fixed top-0 z-50 w-full border-b border-outline-variant/15 bg-surface/85 backdrop-blur-md">
        <Container className="flex h-16 items-center justify-between">
          <Link
            href="/dashboard"
            prefetch={false}
            className="text-xl font-semibold tracking-tighter text-primary"
          >
            ShowCrafter
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {APP_LINKS.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== "/" && pathname?.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={false}
                  className={cn(
                    "pb-1 text-sm font-medium transition-all duration-200",
                    active
                      ? "border-b-2 border-primary-container text-primary-container"
                      : "border-b-2 border-transparent text-on-surface-variant hover:text-primary",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </Container>
      </header>

      <main className="flex-grow pt-24 pb-20">
        <Container width={containerWidth}>{children}</Container>
      </main>
    </div>
  );
}
