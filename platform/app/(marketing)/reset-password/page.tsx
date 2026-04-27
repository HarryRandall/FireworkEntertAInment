"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Lock } from "lucide-react";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";
import { createClient } from "@/utils/supabase/client";
import { FireworkArt } from "../components/FireworkArt";
import { FormError } from "../components/FormError";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setHasSession(Boolean(data.user));
    });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] mx-auto w-full max-w-screen-xl">
      <div className="relative flex flex-col items-center justify-center px-8 py-16 w-full lg:w-[50%] lg:max-w-[600px] lg:flex-none">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-on-surface">
              Set a new password
            </h1>
            <p className="text-base text-on-surface-variant">
              Pick a strong password you don&apos;t use anywhere else.
            </p>
          </div>

          {hasSession === false ? (
            <div className="space-y-4">
              <FormError message="This reset link has expired or already been used. Request a new one." />
              <Link
                href="/forgot-password"
                className="block text-sm font-semibold text-primary hover:underline"
              >
                Request a new reset link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-on-surface"
                >
                  New password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="At least 6 characters"
                  iconLeft={<Lock size={16} strokeWidth={1.75} />}
                  autoComplete="new-password"
                  autoFocus
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-on-surface"
                >
                  Confirm new password
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="Repeat your password"
                  iconLeft={<Lock size={16} strokeWidth={1.75} />}
                  autoComplete="new-password"
                  className="h-12 text-base"
                />
              </div>
              {error && <FormError message={error} />}
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={loading || hasSession === null}
              >
                {loading ? "Saving…" : "Update password"}
              </Button>
            </form>
          )}
        </div>
      </div>

      <div className="relative hidden lg:flex flex-1">
        <FireworkArt />
      </div>
    </div>
  );
}
