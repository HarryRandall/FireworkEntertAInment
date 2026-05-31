'use server';

/**
 * Server actions for the signed-in user's own account:
 * password change and account deletion. Both verify the current
 * password before mutating Supabase auth state.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { hasImpersonationCookie } from '@/lib/impersonation.server';
import { createClient } from '@/utils/supabase/server';
import { createServiceRoleSupabase } from '@/utils/supabase/service-role';

const PasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: z.string().min(8, 'Use at least 8 characters.').max(128, 'Password is too long.'),
    confirmPassword: z.string().min(1, 'Confirm the new password.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

export type PasswordActionState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
};

/** Update the signed-in user's password after verifying their current password. */
export async function updatePasswordAction(
  _prev: PasswordActionState,
  formData: FormData,
): Promise<PasswordActionState> {
  if (await hasImpersonationCookie()) {
    return {
      status: 'error',
      message: 'Password changes are disabled while impersonating a user.',
    };
  }

  const parsed = PasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword') ?? '',
    newPassword: formData.get('newPassword') ?? '',
    confirmPassword: formData.get('confirmPassword') ?? '',
  });
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Check the form details.',
    };
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.email) {
    return { status: 'error', message: 'You are not signed in.' };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (signInError) {
    return { status: 'error', message: 'Current password is incorrect.' };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });
  if (updateError) {
    return {
      status: 'error',
      message: updateError.message || 'Could not update password.',
    };
  }

  return { status: 'success', message: 'Password updated.' };
}

const DeleteAccountSchema = z.object({
  password: z.string().min(1, 'Enter your current password.'),
  confirmation: z.string(),
});

export type DeleteAccountState = {
  status: 'idle' | 'error';
  message?: string;
};

/** Delete the signed-in user's account after verifying their password; signs them out and redirects to /login. */
export async function deleteAccountAction(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  if (await hasImpersonationCookie()) {
    return {
      status: 'error',
      message: 'Account deletion is disabled while impersonating a user.',
    };
  }

  const parsed = DeleteAccountSchema.safeParse({
    password: formData.get('password') ?? '',
    confirmation: formData.get('confirmation') ?? '',
  });
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Check the form details.',
    };
  }
  if (parsed.data.confirmation.trim().toLowerCase() !== 'delete my account') {
    return {
      status: 'error',
      message: 'Type "delete my account" exactly to confirm.',
    };
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.email) {
    return { status: 'error', message: 'You are not signed in.' };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.password,
  });
  if (signInError) {
    return { status: 'error', message: 'Password is incorrect.' };
  }

  const admin = createServiceRoleSupabase();
  if (!admin) {
    return {
      status: 'error',
      message: 'Account deletion is unavailable. Contact support.',
    };
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return {
      status: 'error',
      message: deleteError.message || 'Could not delete account.',
    };
  }

  await supabase.auth.signOut();
  redirect('/login?deleted=1');
}
