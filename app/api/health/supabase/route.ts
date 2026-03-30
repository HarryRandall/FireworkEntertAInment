import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * GET /api/health/supabase
 * Confirms NEXT_PUBLIC_* env is present and the app can reach Supabase (auth endpoint).
 * Safe to call from production after deploy; does not expose secrets.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!url || !key) {
    return NextResponse.json(
      {
        ok: false,
        step: "env",
        message: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
      },
      { status: 503 },
    );
  }

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { error } = await supabase.auth.getUser();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          step: "supabase",
          message: error.message,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      ok: true,
      step: "supabase",
      message: "Reachable (auth.getUser completed; user may be anonymous)",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, step: "exception", message },
      { status: 503 },
    );
  }
}
