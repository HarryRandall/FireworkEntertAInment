import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getShowBySlug } from "@/lib/shows.server";
import { buildFinale3dCsv } from "@/lib/finale3d";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const show = await getShowBySlug(id);
  if (!show) return new NextResponse("Not found", { status: 404 });

  const supabase = createClient(await cookies());

  const { data: cues, error: cuesError } = await supabase
    .from("show_cues")
    .select("time_seconds, effect_spec_id")
    .eq("show_id", show.id)
    .not("time_seconds", "is", null)
    .not("effect_spec_id", "is", null)
    .order("time_seconds", { ascending: true });

  if (cuesError || !cues?.length) {
    return new NextResponse("No cues found", { status: 404 });
  }

  const effectSpecIds = [...new Set(cues.map((c) => c.effect_spec_id as string))];

  const { data: products, error: productsError } = await supabase
    .from("catalogue_products")
    .select("effect_spec_id, name, source_payload")
    .in("effect_spec_id", effectSpecIds);

  if (productsError) {
    return new NextResponse("Failed to fetch products", { status: 500 });
  }

  const productByEffectSpecId = new Map(
    (products ?? []).map((p) => [p.effect_spec_id, p]),
  );

  const csvCues = cues
    .filter((c) => productByEffectSpecId.has(c.effect_spec_id as string))
    .map((c) => {
      const product = productByEffectSpecId.get(c.effect_spec_id as string)!;
      return {
        timeSeconds: Number(c.time_seconds),
        effectName: product.name,
        sourcePayload: product.source_payload,
      };
    });

  if (!csvCues.length) {
    return new NextResponse("No matched products found for this show", { status: 404 });
  }

  const csv = buildFinale3dCsv(csvCues);
  const filename = `${show.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-finale3d.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
