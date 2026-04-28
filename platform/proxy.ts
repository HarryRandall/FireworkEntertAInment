import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseServerEnv } from "@/utils/supabase/env";

const PROTECTED_PREFIXES = ["/dashboard", "/shows"];
const AUTH_ONLY_PATHS = ["/login", "/signup"];

function matchesPathPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: { headers: request.headers },
  });

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) =>
    matchesPathPrefix(pathname, p),
  );
  const isAuthPage = AUTH_ONLY_PATHS.includes(pathname);

  if (!isProtected && !isAuthPage) {
    return supabaseResponse;
  }

  const env = getSupabaseServerEnv();
  if (!env) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[proxy] Missing Supabase URL or key. Add NEXT_PUBLIC_SUPABASE_URL plus NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local. Auth gating disabled.",
      );
    }
    return supabaseResponse;
  }

  // Build a Supabase client that refreshes the session cookie on every request.
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  // Match everything except Next internals, static assets, the auth callback,
  // and API routes (which handle their own auth).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|auth/callback).*)",
  ],
};
