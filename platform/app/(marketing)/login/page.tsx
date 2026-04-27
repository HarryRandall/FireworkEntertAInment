"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Mail, Lock, ArrowLeft } from "lucide-react";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";
import { createClient } from "@/utils/supabase/client";
import { FireworkArt } from "../components/FireworkArt";
import { FormError } from "../components/FormError";

type Step = "email" | "password";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/dashboard";

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  const handleEmailContinue = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setStep("password");
  };

  const handleSignIn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError("Please enter your password.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      const dest = nextPath.startsWith("/") ? nextPath : "/dashboard";
      router.push(dest);
      router.refresh();
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] mx-auto w-full max-w-screen-xl">
      {/* Left — form panel */}
      <div className="relative flex flex-col items-center justify-center px-8 py-16 w-full lg:w-[50%] lg:max-w-[600px] lg:flex-none">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-on-surface">
              {step === "email" ? "Welcome back" : "Enter your password"}
            </h1>
            <p className="text-base text-on-surface-variant">
              {step === "email" ? "Sign in to your ShowCrafter account" : email}
            </p>
          </div>

          {step === "email" ? (
            <form onSubmit={handleEmailContinue} noValidate className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-on-surface">
                  Email address
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  placeholder="you@example.com"
                  iconLeft={<Mail size={16} strokeWidth={1.75} />}
                  autoComplete="email"
                  autoFocus
                  className="h-12 text-base"
                />
              </div>
              {error && <FormError message={error} />}
              <Button type="submit" size="lg" className="w-full">
                Continue
              </Button>
            </form>
          ) : (
            <div className="space-y-5">
              <button
                type="button"
                onClick={() => { setStep("email"); setError(null); }}
                className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition cursor-pointer"
              >
                <ArrowLeft size={14} />
                Use a different email
              </button>

              <form onSubmit={handleSignIn} noValidate className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="block text-sm font-medium text-on-surface">
                      Password
                    </label>
                    <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    placeholder="••••••••"
                    iconLeft={<Lock size={16} strokeWidth={1.75} />}
                    autoComplete="current-password"
                    autoFocus
                    className="h-12 text-base"
                  />
                </div>
                {error && <FormError message={error} />}
                <Button type="submit" size="lg" className="w-full" disabled={loading}>
                  {loading ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </div>
          )}

          <p className="text-sm text-on-surface-variant">
            No account?{" "}
            <Link href="/signup" className="font-semibold text-primary hover:underline">
              Create one free
            </Link>
          </p>
        </div>
      </div>

      {/* Right — art panel */}
      <div className="relative hidden lg:flex flex-1">
        <FireworkArt />
      </div>
    </div>
  );
}
