import { ResetPasswordShell } from '@/app/(marketing)/reset-password/_components/ResetPasswordShell';

export default function ResetPasswordLoading() {
  return (
    <ResetPasswordShell>
      <div className="space-y-1">
        <h1 className="text-foreground text-xl font-semibold tracking-tight">Set a new password</h1>
        <p className="text-muted-foreground text-sm" role="status" aria-live="polite">
          Checking your reset link…
        </p>
      </div>
    </ResetPasswordShell>
  );
}
