import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export const getCurrentUser = cache(async () => {
  const supabase = createClient(await cookies());
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
});

export const getCurrentUserId = cache(async (): Promise<string | null> => {
  const proxiedUserId = (await headers()).get("x-showcrafter-user-id");
  if (proxiedUserId) {
    return proxiedUserId;
  }

  const user = await getCurrentUser();
  return user?.id ?? null;
});
