"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { slugifyTitle } from "@/lib/show-domain";
import { invalidateShowsCacheForUser } from "@/lib/shows.server";
import {
  MusicAnalysisSchema,
  generateCuePlanFromAnalysis,
  listCuePlannerProducts,
} from "@/lib/music-analysis-show";

const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const MAX_ANALYSIS_JSON_BYTES = 5 * 1024 * 1024;
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
  const analysisFile = formData.get("analysisJson");
  let audioPath: string | null = null;
  let generatedCues:
    | Array<{
        timeSeconds: number;
        productId: string;
        description: string;
        launchPositionIndex: number;
      }>
    | null = null;
  let generatorSource: "llm" | "fallback" | null = null;
  let analysisDurationSeconds: number | null = null;

  const removeUploadedAudio = async () => {
    if (audioPath) {
      await supabase.storage.from("audio").remove([audioPath]);
    }
  };

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

  if (analysisFile && analysisFile instanceof File && analysisFile.size > 0) {
    if (analysisFile.size > MAX_ANALYSIS_JSON_BYTES) {
      await removeUploadedAudio();
      return { ok: false, error: "Analysis JSON must be 5MB or smaller." };
    }
    if (
      analysisFile.type &&
      !["application/json", "text/json", ""].includes(analysisFile.type)
    ) {
      await removeUploadedAudio();
      return { ok: false, error: "Unsupported analysis file. Use a JSON file." };
    }

    let rawAnalysis: unknown;
    try {
      rawAnalysis = JSON.parse(await analysisFile.text());
    } catch {
      await removeUploadedAudio();
      return { ok: false, error: "Analysis JSON could not be parsed." };
    }

    const parsedAnalysis = MusicAnalysisSchema.safeParse(rawAnalysis);
    if (!parsedAnalysis.success) {
      const first = parsedAnalysis.error.issues[0];
      await removeUploadedAudio();
      return {
        ok: false,
        error: `Analysis JSON is missing required music timing data: ${first?.path.join(".") || first?.message || "invalid file"}.`,
      };
    }
    analysisDurationSeconds = parsedAnalysis.data.duration_seconds;

    const products = await listCuePlannerProducts(supabase);
    if (products.length === 0) {
      await removeUploadedAudio();
      return {
        ok: false,
        error: "No firework catalogue products are available for the generator.",
      };
    }

    const plan = await generateCuePlanFromAnalysis({
      analysis: parsedAnalysis.data,
      products,
      brief: [
        parsed.data.description,
        parsed.data.vibe,
        parsed.data.moodTags.join(", "),
      ]
        .filter(Boolean)
        .join("\n"),
    });
    generatedCues = plan.cues;
    generatorSource = plan.source;

    if (generatedCues.length === 0) {
      await removeUploadedAudio();
      return {
        ok: false,
        error: "The analysis JSON was valid, but no usable cues could be generated.",
      };
    }
  }

  const baseSlug = slugifyTitle(parsed.data.title);
  const durationSeconds = DURATION_TO_SECONDS[parsed.data.duration] ?? null;

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
      description:
        parsed.data.description ||
        parsed.data.vibe ||
        (generatorSource
          ? `Generated from audio analysis JSON (${generatorSource} planner).`
          : null),
      duration_seconds:
        generatedCues && analysisDurationSeconds
          ? Math.ceil(analysisDurationSeconds)
          : durationSeconds,
      budget_cents: parsed.data.budget * 100,
      time_of_day: parsed.data.timeOfDay,
      location: parsed.data.location || null,
      mood_tags: parsed.data.moodTags,
      audio_path: audioPath,
      effects_count: generatedCues?.length ?? 0,
      sync_percent: generatedCues ? (generatorSource === "llm" ? 88 : 74) : null,
      status: "draft",
    })
    .select("id, slug")
    .single();

  if (insertError || !show) {
    console.error("[createShowAction] insert failed:", insertError);
    await removeUploadedAudio();
    return { ok: false, error: "Could not save your show. Please try again." };
  }

  if (generatedCues?.length) {
    const { error: cuesError } = await supabase.from("show_cues").insert(
      generatedCues.map((cue, index) => ({
        show_id: show.id,
        position: index + 1,
        time_seconds: cue.timeSeconds,
        description: cue.description,
        product_id: cue.productId,
        launch_position_index: cue.launchPositionIndex,
      })),
    );

    if (cuesError) {
      console.error("[createShowAction] generated cue insert failed:", cuesError);
      return {
        ok: false,
        error: "The show was saved, but generated cues could not be added.",
      };
    }
  }

  await invalidateShowsCacheForUser(user.id);
  revalidatePath("/dashboard");
  redirect(generatedCues?.length ? `/shows/${slug}/preview` : `/shows/${slug}`);
}
