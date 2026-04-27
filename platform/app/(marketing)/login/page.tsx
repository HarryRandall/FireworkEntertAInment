"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mail, Lock, ArrowLeft, X, Info } from "lucide-react";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";
import { createClient } from "@/utils/supabase/client";
import { FireworkArt } from "../components/FireworkArt";
import { FormError } from "../components/FormError";

/* ── Toast ────────────────────────────────────────────────────── */

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="fixed left-1/2 top-6 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-high px-5 py-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-sm whitespace-nowrap"
    >
      <Info size={16} className="shrink-0 text-primary" />
      <span className="text-sm text-on-surface">{message}</span>
      <button onClick={onClose} className="ml-1 shrink-0 text-on-surface-variant hover:text-on-surface transition">
        <X size={14} />
      </button>
    </motion.div>
  );
}

/* ── OAuth button ─────────────────────────────────────────────── */

function OAuthButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-outline-variant/25 bg-surface-container px-5 py-3.5 text-sm font-medium text-on-surface shadow-sm transition hover:border-outline-variant/50 hover:bg-surface-container-highest active:scale-[0.99]"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-current" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

/* ── Page ─────────────────────────────────────────────────────── */

type Step = "email" | "password";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
      router.push("/dashboard");
      router.refresh();
    }
  };

  const handleOAuth = () => {
    setToast("OAuth sign-in is coming soon — use email & password for now.");
  };

  return (
    <>
      <AnimatePresence>
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </AnimatePresence>

      <div className="relative flex min-h-[calc(100vh-4rem)]">
        {/* Left — form panel */}
        <div className="relative flex flex-1 flex-col items-center justify-center px-8 py-16 lg:max-w-[50%]">
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
              <div className="space-y-6">
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

                <p className="text-center text-xs font-medium uppercase tracking-widest text-on-surface-variant/40">or</p>

                <div className="space-y-3">
                  <OAuthButton icon={<GoogleIcon />} label="Continue with Google" onClick={handleOAuth} />
                  <OAuthButton icon={<GitHubIcon />} label="Continue with GitHub" onClick={handleOAuth} />
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <button
                  type="button"
                  onClick={() => { setStep("email"); setError(null); }}
                  className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition"
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
                      <a href="#" className="text-sm text-primary hover:underline">
                        Forgot password?
                      </a>
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
    </>
  );
}
