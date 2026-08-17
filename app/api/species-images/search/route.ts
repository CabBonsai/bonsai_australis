// app/api/species-images/search/route.ts
//
// Server-side proxy to the Openverse API. Runs behind the admin app's existing
// password gate (middleware.ts / admin_auth cookie) — same protection pattern
// as /api/admin-table and /api/spotlight-upload. Never call Openverse directly
// from the browser: keeps rate-limit handling and query construction in one
// place, and means the admin UI code doesn't need to know Openverse's schema.
//
// Openverse API: https://api.openverse.org/v1/images/
// Anonymous requests are allowed but rate-limited harder than authenticated
// ones. If bulk mode (many species in a row) starts hitting 429s, register an
// app at https://api.openverse.org/v1/register and add OPENVERSE_CLIENT_ID /
// OPENVERSE_CLIENT_SECRET as env vars, then swap in a client_credentials token
// fetch here. Not needed for single-species manual search.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const OPENVERSE_BASE = "https://api.openverse.org/v1/images/";

export async function GET(req: NextRequest) {
  // Admin auth check — same cookie convention as the rest of bonsai-admin's API routes.
  const cookieStore = await cookies();
  if (cookieStore.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  if (!query || query.trim().length === 0) {
    return NextResponse.json({ error: "Missing query parameter 'q'" }, { status: 400 });
  }

  const params = new URLSearchParams({
    q: query,
    license_type: "commercial", // commercial use only — now also includes CC BY-ND (no-derivatives)
                                 // results, not just commercial+modification. ND images are legally
                                 // fine to use as-is but should NOT be cropped/edited/watermarked —
                                 // the licence field returned per-result shows which is which.
    page_size: "20",
    mature: "false",
  });

  let upstream: Response;
  try {
    upstream = await fetch(`${OPENVERSE_BASE}?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to reach Openverse" }, { status: 502 });
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: `Openverse returned ${upstream.status}`, detail: text.slice(0, 500) },
      { status: 502 }
    );
  }

  const data = await upstream.json();

  // Trim to only the fields the admin UI actually needs — keeps the payload
  // small and means the UI never has to reach into Openverse's raw shape.
  const results = (data.results ?? []).map((img: any) => ({
    external_id: img.id,
    title: img.title,
    image_url: img.url,
    thumbnail_url: img.thumbnail,
    photographer: img.creator ?? "Unknown",
    photographer_url: img.creator_url ?? null,
    licence: img.license ? `${img.license}`.toUpperCase() : "unknown",
    licence_version: img.license_version ?? null,
    licence_url: img.license_url ?? null,
    source_page_url: img.foreign_landing_url ?? img.url,
    source: "openverse",
  }));

  return NextResponse.json({ results, result_count: data.result_count ?? results.length });
}
