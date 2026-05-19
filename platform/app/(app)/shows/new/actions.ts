"use server";

import { cookies } from "next/headers";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { runShowAnalysisForShow } from "@/lib/show-analysis-runner.server";
import { slugifyTitle } from "@/lib/show-domain";
import { invalidateShowsCacheForUser } from "@/lib/shows.server";

const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/aac",
  "audio/mp4",
  "audio/x-m4a",
]);

const DURATION_TO_SECONDS: Record<string, number> = {
  "1 minute": 60,
  "2 minutes": 120,
  "3 minutes": 180,
  "5 minutes": 300,
  "10 minutes": 600,
};

function parseDurationSeconds(duration: string) {
  if (DURATION_TO_SECONDS[duration] != null) return DURATION_TO_SECONDS[duration];

  const match = duration.trim().match(/^(\d+)\s+minutes?$/i);
  if (!match) return null;

  const minutes = Number(match[1]);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 60) return null;
  return minutes * 60;
}

const NewShowSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  vibe: z.string().trim().max(280).optional(),
  budget: z.coerce.number().int().min(50).max(5000),
  duration: z.string().min(1),
  timeOfDay: z.enum(["Daytime", "Dusk", "Night"]),
  location: z.string().trim().max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  moodTags: z.array(z.string().min(1).max(40)).max(20),
});

export type NewShowResult =
  | { ok: true }
  | { ok: false; error: string };

export async function createShowAction(
  formData: FormData,
): Promise<NewShowResult> {
  const supabase = createClient(await cookies());

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, error: "You must be signed in to create a show." };
  }

  const parsed = NewShowSchema.safeParse({
    title: formData.get("title") ?? "",
    vibe: formData.get("vibe") ?? "",
    budget: formData.get("budget"),
    duration: formData.get("duration") ?? "",
    timeOfDay: formData.get("timeOfDay") ?? "",
    location: formData.get("location") ?? "",
    description: formData.get("description") ?? "",
    moodTags: formData.getAll("moodTags").map(String),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: first?.message ?? "Please fill out all required fields.",
    };
  }

  const audioFile = formData.get("audio");
  let audioPath: string | null = null;

  if (audioFile && audioFile instanceof File && audioFile.size > 0) {
    if (audioFile.size > MAX_AUDIO_BYTES) {
      return { ok: false, error: "Audio file must be 50MB or smaller." };
    }
    if (audioFile.type && !ALLOWED_AUDIO_TYPES.has(audioFile.type)) {
      return {
        ok: false,
        error: "Unsupported audio format. Use MP3, WAV, AAC, or M4A.",
      };
    }

    const safeName = audioFile.name
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .slice(0, 80) || "audio";
    const objectKey = `${user.id}/${crypto.randomUUID()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("audio")
      .upload(objectKey, audioFile, {
        contentType: audioFile.type || "audio/mpeg",
        upsert: false,
      });
    if (uploadError) {
      console.error("[createShowAction] audio upload failed:", uploadError);
      return { ok: false, error: "Could not upload audio file. Try again." };
    }
    audioPath = objectKey;
  }

  const baseSlug = slugifyTitle(parsed.data.title);
  const durationSeconds = parseDurationSeconds(parsed.data.duration);

  // Avoid clashing with an existing slug for the same user.
  let slug = baseSlug;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: existing } = await supabase
      .from("shows")
      .select("id")
      .eq("user_id", user.id)
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const { data: show, error: insertError } = await supabase
    .from("shows")
    .insert({
      user_id: user.id,
      slug,
      title: parsed.data.title,
      description: parsed.data.description || parsed.data.vibe || null,
      duration_seconds: durationSeconds,
      budget_cents: parsed.data.budget * 100,
      time_of_day: parsed.data.timeOfDay,
      location: parsed.data.location || null,
      mood_tags: parsed.data.moodTags,
      audio_path: audioPath,
      status: "draft",
    })
    .select("id, slug")
    .single();

  if (insertError || !show) {
    console.error("[createShowAction] insert failed:", insertError);
    if (audioPath) {
      await supabase.storage.from("audio").remove([audioPath]);
    }
    return { ok: false, error: "Could not save your show. Please try again." };
  }

  await invalidateShowsCacheForUser(user.id);
  revalidatePath("/dashboard");
  if (audioPath) {
    after(async () => {
      const result = await runShowAnalysisForShow({
        supabase,
        userId: user.id,
        showId: show.id,
        personality: "balanced",
      });
      if (!result.ok) {
        console.error("[createShowAction] background analysis failed:", result.error);
      }
    });
  }
  redirect(`/shows/${slug}`);
}
