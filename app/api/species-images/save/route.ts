// app/api/species-images/save/route.ts
//
// Writes an approved image's metadata to species_images using the shared
// service-role client (lib/supabaseServer.ts) — same convention as
// /api/admin-table and /api/spotlight-upload. species_images has RLS enabled
// with zero anon/public policies, so this route is the only write path.
//
// This route stores metadata only — it does not re-host the image file itself.
// image_url points at the source (Openverse-hosted or original creator's URL).
// If the public site later needs images served from Bonsai Australis' own
// storage rather than hotlinked, that's a separate follow-up (download +
// upload to a Supabase Storage bucket), not part of this pass.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    sp_no,
    source_api,
    external_id,
    image_url,
    thumbnail_url,
    photographer,
    licence,
    licence_url,
    source_page_url,
  } = body;

  // Minimum viable record — attribution_text is built server-side so the
  // format is consistent everywhere it's ever rendered, rather than trusting
  // the client to construct it correctly each time.
  if (!sp_no || !source_api || !image_url || !licence || !source_page_url) {
    return NextResponse.json(
      { error: "Missing required field(s): sp_no, source_api, image_url, licence, source_page_url" },
      { status: 400 }
    );
  }

  const attribution_text = `${photographer || "Unknown photographer"} — ${licence}, via ${
    source_api === "openverse" ? "Openverse" : source_api
  }. Source: ${source_page_url}`;

  const { data, error } = await supabaseServer
    .from("species_images")
    .insert({
      sp_no,
      source_api,
      external_id: external_id ?? null,
      image_url,
      thumbnail_url: thumbnail_url ?? null,
      photographer: photographer ?? null,
      licence,
      licence_url: licence_url ?? null,
      attribution_text,
      source_page_url,
      is_approved: true,
      approved_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    // Unique constraint hit (species_images_dedupe) means this exact image
    // was already imported for this species — not a real failure, just a
    // no-op the UI can treat as "already saved."
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already imported for this species", duplicate: true }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ saved: data }, { status: 201 });
}
