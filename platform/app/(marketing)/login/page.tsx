"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Rocket, Mail, Lock } from "lucide-react";
import { Card } from "@/app/components/ui/Card";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";

// TODO(FIR-56): wire this form to the Supabase auth flow once that issue lands.
// For now this is a UI-only stub that simply navigates to /dashboard so the
// rest of the redesign can be reviewed end-to-end.

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@showcrafter.com");
  const [password, setPassword] = useState("password123");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    router.push("/dashboard");
  };

  const handleGuest = () => {
    router.push("/dashboard");
  };

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-3 text-center">
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Rocket size={28} strokeWidth={1.75} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface">
            Welcome back
          </h1>
          <p className="text-on-surface-variant">
            Sign in to your ShowCrafter account
          </p>
        </div>

        <Card elevation="high" radius="lg" className="space-y-6 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-sm font-semibold uppercase tracking-wider text-on-surface"
              >
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                iconLeft={<Mail size={16} strokeWidth={1.75} />}
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-sm font-semibold uppercase tracking-wider text-on-surface"
              >
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                iconLeft={<Lock size={16} strokeWidth={1.75} />}
                autoComplete="current-password"
                required
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-outline-variant/40 bg-surface-container-highest text-primary accent-primary focus:ring-primary/30"
                />
                <span className="text-sm text-on-surface-variant">
                  Remember me
                </span>
              </label>
              <a href="#" className="text-sm text-primary hover:underline">
                Forgot password?
              </a>
            </div>

            <Button type="submit" size="md" className="w-full">
              Sign in
            </Button>
          </form>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-outline-variant/10" />
            </div>
            <span className="relative bg-surface-container-high px-4 text-xs uppercase tracking-widest text-on-surface-variant">
              or
            </span>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="md"
            className="w-full"
            onClick={handleGuest}
          >
            Continue as guest
          </Button>
        </Card>

        <p className="text-center text-sm text-on-surface-variant">
          Don&apos;t have an account?{" "}
          <Link href="#" className="font-medium text-primary hover:underline">
            Sign up free
          </Link>
        </p>

        <Card
          elevation="low"
          radius="md"
          className="border-outline-variant/5 bg-surface-container-low p-4 text-center"
        >
          <p className="text-xs text-on-surface-variant">
            <span className="font-bold text-primary">Demo mode:</span> any email
            and password will work. Pre-filled for convenience.
          </p>
        </Card>
      </div>
    </main>
  );
}
