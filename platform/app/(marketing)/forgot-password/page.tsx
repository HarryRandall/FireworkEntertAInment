"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Mail, CheckCircle } from "lucide-react";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";
import { createClient } from "@/utils/supabase/client";
import { FireworkArt } from "../components/FireworkArt";
import { FormError } from "../components/FormError";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const supabase = createClient();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] mx-auto w-full max-w-screen-xl">
      <div className="relative flex flex-col items-center justify-center px-8 py-16 w-full lg:w-[50%] lg:max-w-[600px] lg:flex-none">
        <div className="w-full max-w-md space-y-8">
          {sent ? (
            <div className="space-y-6 text-center">
              <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-success/30 bg-success/10 text-success">
                <CheckCircle size={28} strokeWidth={1.5} />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-on-surface">
                  Check your inbox
                </h1>
                <p className="text-base text-on-surface-variant">
                  If an account exists for{" "}
                  <span className="font-medium text-on-surface">{email}</span>,
                  we&apos;ve sent a password reset link. The link expires in 1
                  hour.
                </p>
              </div>
              <p className="text-sm text-on-surface-variant">
                <Link
                  href="/login"
                  className="font-semibold text-primary hover:underline"
                >
                  Back to sign in
                </Link>
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight text-on-surface">
                  Reset your password
                </h1>
                <p className="text-base text-on-surface-variant">
                  Enter the email associated with your ShowCrafter account and
                  we&apos;ll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-on-surface"
                  >
                    Email address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(null);
                    }}
                    placeholder="you@example.com"
                    iconLeft={<Mail size={16} strokeWidth={1.75} />}
                    autoComplete="email"
                    autoFocus
                    className="h-12 text-base"
                  />
                </div>
                {error && <FormError message={error} />}
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? "Sending…" : "Send reset link"}
                </Button>
              </form>

              <p className="text-sm text-on-surface-variant">
                Remembered it?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-primary hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>

      <div className="relative hidden lg:flex flex-1">
        <FireworkArt />
      </div>
    </div>
  );
}
