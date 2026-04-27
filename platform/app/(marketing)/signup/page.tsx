"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Mail, Lock, User, Sparkles, CheckCircle } from "lucide-react";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";
import { createClient } from "@/utils/supabase/client";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-current" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

type Step = "email" | "details" | "confirm";

export default function SignupPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthHint, setOauthHint] = useState(false);

  const supabase = createClient();

  const handleEmailContinue = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setStep("details");
  };

  const handleSignUp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setStep("confirm");
    }
  };

  const handleOAuth = () => {
    setOauthHint(true);
    setTimeout(() => setOauthHint(false), 3500);
  };

  if (step === "confirm") {
    return (
      <main className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-16 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-96 w-96 rounded-full bg-primary/8 blur-3xl" />
        </div>
        <div className="relative w-full max-w-sm space-y-6 text-center">
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-success/30 bg-success/10 text-success shadow-[0_0_24px_rgba(14,203,129,0.12)]">
            <CheckCircle size={28} strokeWidth={1.5} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-on-surface">Check your inbox</h1>
            <p className="text-sm text-on-surface-variant">
              We sent a confirmation link to{" "}
              <span className="font-medium text-on-surface">{email}</span>.
              Click it to activate your account.
            </p>
          </div>
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-high/80 p-6 text-sm text-on-surface-variant">
            Already confirmed?{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-16 overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-96 w-96 rounded-full bg-primary/8 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm space-y-6">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {["email", "details"].map((s, i) => (
            <div
              key={s}
              className={`h-1 rounded-full transition-all duration-300 ${
                (step === "email" && i === 0) || (step === "details" && i <= 1)
                  ? "w-8 bg-primary"
                  : "w-4 bg-outline-variant/30"
              }`}
            />
          ))}
        </div>

        {/* Header */}
        <div className="space-y-2 text-center">
          <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-[0_0_24px_rgba(255,193,116,0.15)]">
            <Sparkles size={24} strokeWidth={1.75} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">
            {step === "email" ? "Create your account" : "Almost there"}
          </h1>
          <p className="text-sm text-on-surface-variant">
            {step === "email" ? "Design your first firework show" : email}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-high/80 p-7 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-sm">
          {step === "email" ? (
            <div className="space-y-5">
              <form onSubmit={handleEmailContinue} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                    Email address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    iconLeft={<Mail size={15} strokeWidth={1.75} />}
                    autoComplete="email"
                    autoFocus
                    required
                  />
                </div>
                {error && <p className="text-xs text-error">{error}</p>}
                <Button type="submit" size="md" className="w-full">
                  Continue
                </Button>
              </form>

              <div className="relative flex items-center">
                <div className="flex-grow border-t border-outline-variant/15" />
                <span className="mx-3 text-xs text-on-surface-variant/50 uppercase tracking-widest">or</span>
                <div className="flex-grow border-t border-outline-variant/15" />
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={handleOAuth}
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-outline-variant/20 bg-surface-container px-4 py-2.5 text-sm font-medium text-on-surface-variant transition hover:border-outline-variant/40 hover:text-on-surface"
                >
                  <GoogleIcon />
                  Sign up with Google
                  <span className="ml-auto rounded-md bg-surface-container-highest px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/50">
                    Soon
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleOAuth}
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-outline-variant/20 bg-surface-container px-4 py-2.5 text-sm font-medium text-on-surface-variant transition hover:border-outline-variant/40 hover:text-on-surface"
                >
                  <GitHubIcon />
                  Sign up with GitHub
                  <span className="ml-auto rounded-md bg-surface-container-highest px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/50">
                    Soon
                  </span>
                </button>

                {oauthHint && (
                  <p className="text-center text-xs text-on-surface-variant">
                    OAuth sign-up is coming soon — use email & password for now.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="fullName" className="block text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Full name
                </label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Harry Randall"
                  iconLeft={<User size={15} strokeWidth={1.75} />}
                  autoComplete="name"
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  iconLeft={<Lock size={15} strokeWidth={1.75} />}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="confirmPassword" className="block text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Confirm password
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  iconLeft={<Lock size={15} strokeWidth={1.75} />}
                  autoComplete="new-password"
                  required
                />
              </div>

              {error && <p className="text-xs text-error">{error}</p>}

              <Button type="submit" size="md" className="w-full" disabled={loading}>
                {loading ? "Creating account…" : "Create account"}
              </Button>

              <button
                type="button"
                onClick={() => { setStep("email"); setError(null); }}
                className="w-full text-center text-xs text-on-surface-variant hover:text-on-surface transition"
              >
                ← Back
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-on-surface-variant">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
