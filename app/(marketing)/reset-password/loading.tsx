import { ResetPasswordShell } from './ResetPasswordShell';

export default function ResetPasswordLoading() {
  return (
    <ResetPasswordShell>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-content-emphasis)]">
          Set a new password
        </h1>
        <p
          className="text-sm text-[color:var(--color-content-subtle)]"
          role="status"
          aria-live="polite"
        >
          Checking your reset link…
        </p>
      </div>
    </ResetPasswordShell>
  );
}
