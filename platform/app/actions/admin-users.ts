"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { requirePermission } from "@/lib/admin.server";

type Result = { ok: true } | { ok: false; error: string };

const SetStatusSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(["active", "suspended"]),
});

const SetRoleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
});

const DeleteUserSchema = z.object({
  userId: z.string().uuid(),
});

const OverrideSchema = z.object({
  userId: z.string().uuid(),
  permissionId: z.string().uuid(),
  mode: z.enum(["grant", "deny", "clear"]),
});

export async function setUserStatusAction(input: z.infer<typeof SetStatusSchema>): Promise<Result> {
  const admin = await requirePermission("admin.manage_users");
  if (!admin) return { ok: false, error: "Not permitted." };
  const parsed = SetStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from("profiles")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${parsed.data.userId}`);
  return { ok: true };
}

export async function setUserRoleAction(input: z.infer<typeof SetRoleSchema>): Promise<Result> {
  const admin = await requirePermission("admin.manage_users");
  if (!admin) return { ok: false, error: "Not permitted." };
  const parsed = SetRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const supabase = createClient(await cookies());
  const { error: deleteError } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", parsed.data.userId);
  if (deleteError) return { ok: false, error: deleteError.message };

  const { error: insertError } = await supabase
    .from("user_roles")
    .insert({
      user_id: parsed.data.userId,
      role_id: parsed.data.roleId,
      assigned_by: admin.id,
    });
  if (insertError) return { ok: false, error: insertError.message };

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${parsed.data.userId}`);
  return { ok: true };
}

export async function deleteUserAction(input: z.infer<typeof DeleteUserSchema>): Promise<Result> {
  const admin = await requirePermission("admin.manage_users");
  if (!admin) return { ok: false, error: "Not permitted." };
  const parsed = DeleteUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const supabase = createClient(await cookies());
  const { error } = await supabase.from("profiles").delete().eq("id", parsed.data.userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserPermissionOverrideAction(
  input: z.infer<typeof OverrideSchema>,
): Promise<Result> {
  const admin = await requirePermission("admin.manage_users");
  if (!admin) return { ok: false, error: "Not permitted." };
  const parsed = OverrideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const supabase = createClient(await cookies());
  if (parsed.data.mode === "clear") {
    const { error } = await supabase
      .from("user_permission_overrides")
      .delete()
      .eq("user_id", parsed.data.userId)
      .eq("permission_id", parsed.data.permissionId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("user_permission_overrides").upsert({
      user_id: parsed.data.userId,
      permission_id: parsed.data.permissionId,
      enabled: parsed.data.mode === "grant",
      assigned_by: admin.id,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/admin/users/${parsed.data.userId}`);
  return { ok: true };
}
