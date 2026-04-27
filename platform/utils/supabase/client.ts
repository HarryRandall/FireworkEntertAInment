import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseBrowserEnv } from "@/utils/supabase/env";

export const createClient = () => {
  const env = getSupabaseBrowserEnv();
  if (!env) {
    throw new Error(
      "Supabase browser client: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY (must be NEXT_PUBLIC_* for the browser).",
    );
  }
  return createBrowserClient(env.url, env.key);
};
