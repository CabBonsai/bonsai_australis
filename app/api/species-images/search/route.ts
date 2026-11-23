// app/api/species-images/search/route.ts
//
// Server-side multi-source image search. Runs behind the admin app's existing
// password gate (middleware.ts / admin_auth cookie) — same protection pattern
// as /api/admin-table and /api/spotlight-upload. Never call these APIs directly
// from the browser: keeps rate-limit handling and query construction in one
// place, and means the admin UI code doesn't need to know each provider's schema.
//
// Sources (all queried in parallel, merged and de-duplicated by image URL):
//   - Openverse                           (broad, includes Flickr / Wikimedia / iNaturalist mirrors)
//   - iNaturalist                         (worldwide research-grade photos by exact taxon name; skipped when "bonsai" is on)
//   - Wikimedia Commons                   (file search by name)
//
// Only commercial-use-safe licences are returned from every source: CC0, public
// domain, CC BY, CC BY-SA and CC BY-ND. NonCommercial licences are dropped.
// ND results are legally fine to use as-is but must NOT be cropped/edited/watermarked
// — the licence field per result shows which is which (the UI flags ND).
//
// A provider that fails or is rate-limited does not fail the whole search; its
// status is reported in `providers` so the UI can say which sources responded.
//
// Openverse anonymous requests are rate-limited harder than authenticated ones.
// If 429s become common, register an app at https://api.openverse.org/v1/register
// and add OPENVERSE_CLIENT_ID / OPENVERSE_CLIENT_SECRET, then swap in a
// client_credentials token fetch here.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const OPENVERSE_BASE = "https://api.openverse.org/v1/images/";
const INAT_BASE = "https://api.inaturalist.org/v1/observations";
const COMMONS_BASE = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT = "BonsaiAustralisAdmin/1.0 (image search; admin tool)";
const PER_SOURCE = 20;
const MAX_RESULTS = 60;

type Result = {
  external_id: string;
  title: string;
  image_url: string;
  thumbnail_url: string;
  photographer: string;
  photographer_url: string | null;
  licence: string;
  licence_version: string | null;
  licence_url: string | null;
  source_page_url: string;
  source: string; // stored as species_images.source_api
};

type ProviderStatus = { name: string; ok: boolean; count: number; error?: string };

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

async function searchOpenverse(q: string): Promise<Result[]> {
  const params = new URLSearchParams({
    q,
    license_type: "commercial",
    page_size: String(PER_SOURCE),
    mature: "false",
  });
  const data = await getJson(`${OPENVERSE_BASE}?${params.toString()}`);
  return (data.results ?? []).map((img: any): Result => ({
    external_id: img.id,
    title: img.title ?? q,
    image_url: img.url,
    thumbnail_url: img.thumbnail ?? img.url,
    photographer: img.creator ?? "Unknown",
    photographer_url: img.creator_url ?? null,
    licence: img.license ? `${img.license}`.toUpperCase() : "unknown",
    licence_version: img.license_version ?? null,
    licence_url: img.license_url ?? null,
    source_page_url: img.foreign_landing_url ?? img.url,
    source: "openverse",
  }));
}

const INAT_LICENCES: Record<string, { label: string; slug: string }> = {
  cc0: { label: "CC0", slug: "zero/1.0" },
  "cc-by": { label: "CC BY", slug: "by/4.0" },
  "cc-by-sa": { label: "CC BY-SA", slug: "by-sa/4.0" },
  "cc-by-nd": { label: "CC BY-ND", slug: "by-nd/4.0" },
};

async function searchInaturalist(q: string): Promise<Result[]> {
  const params = new URLSearchParams({
    taxon_name: q,
    photo_license: Object.keys(INAT_LICENCES).join(","),
    quality_grade: "research",
    photos: "true",
    order_by: "votes",
    per_page: String(PER_SOURCE),
  });
  const data = await getJson(`${INAT_BASE}?${params.toString()}`);
  const out: Result[] = [];
  for (const obs of data.results ?? []) {
    const photo = obs.photos?.[0];
    const lic = photo?.license_code ? INAT_LICENCES[String(photo.license_code).toLowerCase()] : undefined;
    if (!photo?.url || !lic) continue;
    out.push({
      external_id: `inaturalist:${photo.id}`,
      title: obs.taxon?.name ?? q,
      image_url: String(photo.url).replace("/square.", "/large."),
      thumbnail_url: String(photo.url).replace("/square.", "/medium."),
      photographer: obs.user?.name || obs.user?.login || "Unknown",
      photographer_url: obs.user?.login ? `https://www.inaturalist.org/people/${obs.user.login}` : null,
      licence: lic.label,
      licence_version: null,
      licence_url: `https://creativecommons.org/${lic.slug.startsWith("zero") ? "publicdomain" : "licenses"}/${lic.slug}/`,
      source_page_url: obs.uri ?? `https://www.inaturalist.org/observations/${obs.id}`,
      source: "inaturalist",
    });
  }
  return out;
}

function stripHtml(s: string | undefined): string {
  return (s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

async function searchCommons(q: string): Promise<Result[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: `${q} filetype:bitmap`,
    gsrnamespace: "6",
    gsrlimit: String(PER_SOURCE),
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "400",
  });
  const data = await getJson(`${COMMONS_BASE}?${params.toString()}`);
  const pages: any[] = Object.values(data.query?.pages ?? {});
  const out: Result[] = [];
  for (const p of pages) {
    const info = p.imageinfo?.[0];
    const meta = info?.extmetadata ?? {};
    const licence = stripHtml(meta.LicenseShortName?.value);
    const upper = licence.toUpperCase();
    // Keep only commercial-safe: public domain / CC0 / CC BY / BY-SA / BY-ND. Drop NC and non-free.
    const isFree = meta.NonFree?.value !== "true" && meta.Restrictions?.value !== "trademarked";
    const isPdOrCc = upper.startsWith("CC") || upper.startsWith("PUBLIC DOMAIN") || upper.startsWith("PD");
    if (!info?.url || !isFree || !isPdOrCc || upper.includes("NC")) continue;
    out.push({
      external_id: `commons:${p.pageid}`,
      title: stripHtml(p.title).replace(/^File:/, ""),
      image_url: info.url,
      thumbnail_url: info.thumburl ?? info.url,
      photographer: stripHtml(meta.Artist?.value) || "Unknown",
      photographer_url: null,
      licence,
      licence_version: null,
      licence_url: meta.LicenseUrl?.value ?? null,
      source_page_url: info.descriptionurl ?? info.url,
      source: "wikimedia-commons",
    });
  }
  return out;
}

export async function GET(req: NextRequest) {
  // Admin auth check — same cookie convention as the rest of bonsai-admin's API routes.
  const cookieStore = await cookies();
  if (cookieStore.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ error: "Missing query parameter 'q'" }, { status: 400 });
  }

  // Older callers appended " bonsai" to the query; strip it, then apply the
  // explicit `bonsai` choice (1 = add the word, anything else = leave it out).
  const species = query.replace(/\s+bonsai$/i, "").trim() || query;
  const withBonsai = searchParams.get("bonsai") === "1";
  const text = withBonsai ? `${species} bonsai` : species;

  // iNaturalist searches by exact taxon name, so it only runs when "bonsai" is off.
  const jobs: { name: string; run: () => Promise<Result[]> }[] = [
    { name: "Openverse", run: () => searchOpenverse(text) },
    ...(withBonsai ? [] : [{ name: "iNaturalist", run: () => searchInaturalist(species) }]),
    { name: "Wikimedia Commons", run: () => searchCommons(text) },
  ];

  const settled = await Promise.allSettled(jobs.map((j) => j.run()));

  const providers: ProviderStatus[] = [];
  const lists: Result[][] = [];
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") {
      lists.push(s.value);
      providers.push({ name: jobs[i].name, ok: true, count: s.value.length });
    } else {
      lists.push([]);
      providers.push({
        name: jobs[i].name,
        ok: false,
        count: 0,
        error: s.reason instanceof Error ? s.reason.message : "failed",
      });
    }
  });

  // Interleave sources so no single provider fills the first screen, then
  // de-duplicate by image URL (the same photo often appears in several indexes).
  const seen = new Set<string>();
  const results: Result[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest && results.length < MAX_RESULTS; i++) {
    for (const list of lists) {
      const item = list[i];
      if (!item || seen.has(item.image_url)) continue;
      seen.add(item.image_url);
      results.push(item);
      if (results.length >= MAX_RESULTS) break;
    }
  }

  if (results.length === 0 && providers.every((p) => !p.ok)) {
    return NextResponse.json(
      { error: "All image sources failed or were rate-limited. Try again shortly.", providers },
      { status: 502 }
    );
  }

  return NextResponse.json({ results, result_count: results.length, providers });
}
