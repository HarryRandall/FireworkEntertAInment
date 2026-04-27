"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Mail, Lock, User, CheckCircle, ArrowLeft } from "lucide-react";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";
import { createClient } from "@/utils/supabase/client";
import { FireworkArt } from "../components/FireworkArt";
import { FormError } from "../components/FormError";

type Step = "email" | "details" | "confirm";

export default function SignupPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
    setStep("details");
  };

  const handleSignUp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
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

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] mx-auto w-full max-w-screen-xl">
      {/* Left — form panel */}
      <div className="relative flex flex-col items-center justify-center px-8 py-16 w-full lg:w-[50%] lg:max-w-[600px] lg:flex-none">
        <div className="w-full max-w-md space-y-8">

          {step === "confirm" ? (
            <div className="space-y-6 text-center">
              <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-success/30 bg-success/10 text-success">
                <CheckCircle size={28} strokeWidth={1.5} />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-on-surface">Check your inbox</h1>
                <p className="text-base text-on-surface-variant">
                  We sent a confirmation link to{" "}
                  <span className="font-medium text-on-surface">{email}</span>.
                  Click it to activate your account.
                </p>
              </div>
              <p className="text-sm text-on-surface-variant">
                Already confirmed?{" "}
                <Link href="/login" className="font-semibold text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      (step === "email" && i === 0) || step === "details"
                        ? "w-8 bg-primary"
                        : "w-4 bg-outline-variant/30"
                    }`}
                  />
                ))}
              </div>

              <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight text-on-surface">
                  {step === "email" ? "Create your account" : "Almost there"}
                </h1>
                <p className="text-base text-on-surface-variant">
                  {step === "email" ? "Design your first firework show" : email}
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

                  <form onSubmit={handleSignUp} noValidate className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="fullName" className="block text-sm font-medium text-on-surface">
                        Full name
                      </label>
                      <Input
                        id="fullName"
                        type="text"
                        value={fullName}
                        onChange={(e) => { setFullName(e.target.value); setError(null); }}
                        placeholder="Your full name"
                        iconLeft={<User size={16} strokeWidth={1.75} />}
                        autoComplete="name"
                        autoFocus
                        className="h-12 text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="password" className="block text-sm font-medium text-on-surface">
                        Password
                      </label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(null); }}
                        placeholder="Create a password"
                        iconLeft={<Lock size={16} strokeWidth={1.75} />}
                        autoComplete="new-password"
                        className="h-12 text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-on-surface">
                        Confirm password
                      </label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                        placeholder="Repeat your password"
                        iconLeft={<Lock size={16} strokeWidth={1.75} />}
                        autoComplete="new-password"
                        className="h-12 text-base"
                      />
                    </div>
                    {error && <FormError message={error} />}
                    <Button type="submit" size="lg" className="w-full" disabled={loading}>
                      {loading ? "Creating account…" : "Create account"}
                    </Button>
                  </form>
                </div>
              )}

              <p className="text-sm text-on-surface-variant">
                Already have an account?{" "}
                <Link href="/login" className="font-semibold text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>

      {/* Right — art panel */}
      <div className="relative hidden lg:flex flex-1">
        <FireworkArt />
      </div>
    </div>
  );
}
