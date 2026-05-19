"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  updatePasswordAction,
  type PasswordActionState,
} from "@/app/actions/account";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { InlineAlert } from "@/app/components/ui/Feedback";
import { Field, FieldLabel } from "@/app/components/ui/Field";

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
      className="space-y-4"
    >
      <Field>
        <FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
        <Input
          id="currentPassword"
          type="password"
          name="currentPassword"
          autoComplete="current-password"
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="newPassword">New password</FieldLabel>
          <Input
            id="newPassword"
            type="password"
            name="newPassword"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
          <Input
            id="confirmPassword"
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
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

      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          Update password
        </Button>
      </div>
    </form>
  );
}
