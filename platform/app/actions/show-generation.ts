"use server";

export type GenerateCuesActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  generatedCount?: number;
};

export async function generateCuesFromAnalysisAction(
  _prev: GenerateCuesActionState,
  _formData: FormData,
): Promise<GenerateCuesActionState> {
  void _prev;
  void _formData;

  return {
    status: "error",
    message:
      "Cue generation is disabled for now. The app stores song analysis JSON, Markdown, and AI peak anchors only.",
  };
}
