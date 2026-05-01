"use client";

import { useActionState, useEffect, useRef } from "react";
import { KeyRound } from "lucide-react";
import {
  updatePasswordAction,
  type PasswordActionState,
} from "@/app/actions/account";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { InlineAlert } from "@/app/components/ui/Feedback";

const initialState: PasswordActionState = { status: "idle" };

export function PasswordChangeForm() {
  const [state, formAction, pending] = useActionState(
    updatePasswordAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4 rounded-xl border border-outline-variant/45 bg-surface-container-low p-5"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant/45 bg-surface-container-low text-primary">
          <KeyRound size={18} strokeWidth={1.85} />
        </span>
        <div>
          <h3 className="font-bold text-on-surface">Change password</h3>
          <p className="text-xs text-on-surface-variant">
            You will stay signed in on this device.
          </p>
        </div>
      </div>

      <label className="block space-y-1.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
          Current password
        </span>
        <Input
          type="password"
          name="currentPassword"
          autoComplete="current-password"
          required
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
            New password
          </span>
          <Input
            type="password"
            name="newPassword"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
            Confirm new password
          </span>
          <Input
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
      </div>

      {state.status === "error" && state.message ? (
        <InlineAlert tone="danger" title="Password not updated">
          {state.message}
        </InlineAlert>
      ) : null}
      {state.status === "success" ? (
        <InlineAlert tone="success" title="Password updated">
          {state.message}
        </InlineAlert>
      ) : null}

      <div>
        <Button type="submit" loading={pending}>
          Update password
        </Button>
      </div>
    </form>
  );
}
