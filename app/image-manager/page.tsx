// app/image-manager/page.tsx
//
// Manual/semi-automatic image sourcing (Option 2 from session 25 discussion).
// One species at a time: search Openverse, review thumbnails + licence/photographer
// info, approve individually. Nothing auto-saves — every image requires a click.
// Bulk mode (whole genus at once) is a deliberate follow-up, not built here, so
// the review discipline gets tested on a handful of species first.
//
// Uses inline styles throughout per the project's existing convention
// (Tailwind doesn't render correctly in production on this app).

"use client";

import { useState } from "react";

type SearchResult = {
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
  source: string;
};

export default function ImageManagerPage() {
  const [spNo, setSpNo] = useState("");
  const [speciesName, setSpeciesName] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);

  async function handleSearch() {
    if (!speciesName.trim()) {
      setError("Enter a species name to search.");
      return;
    }
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const res = await fetch(`/api/species-images/search?q=${encodeURIComponent(speciesName)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Search failed.");
      } else {
        setResults(data.results);
      }
    } catch (err) {
      setError("Network error reaching the search endpoint.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(img: SearchResult) {
    if (!spNo.trim()) {
      setError("Enter the sp_no this image belongs to before approving.");
      return;
    }
    setSavingId(img.external_id);
    setError(null);
    try {
      const res = await fetch("/api/species-images/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sp_no: Number(spNo),
          source_api: img.source,
          external_id: img.external_id,
          image_url: img.image_url,
          thumbnail_url: img.thumbnail_url,
          photographer: img.photographer,
          licence: img.licence,
          licence_url: img.licence_url,
          source_page_url: img.source_page_url,
        }),
      });
      const data = await res.json();
      if (!res.ok && !data.duplicate) {
        setError(data.error || "Save failed.");
        return;
      }
      setSavedIds((prev) => new Set(prev).add(img.external_id));
    } catch (err) {
      setError("Network error reaching the save endpoint.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Image Manager</h1>
      <p style={{ color: "#666", marginBottom: 24, fontSize: 14 }}>
        Search Openverse for licence-cleared images. Nothing saves automatically — review each
        result and approve individually.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#555", marginBottom: 4 }}>
            sp_no (target species)
          </label>
          <input
            value={spNo}
            onChange={(e) => setSpNo(e.target.value)}
            placeholder="e.g. 896"
            style={{ padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4, width: 140 }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label style={{ display: "block", fontSize: 12, color: "#555", marginBottom: 4 }}>
            Species / botanical name
          </label>
          <input
            value={speciesName}
            onChange={(e) => setSpeciesName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="e.g. Acacia cognata"
            style={{ padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4, width: "100%" }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button
            onClick={handleSearch}
            disabled={loading}
            style={{
              padding: "9px 18px",
              background: "#2E2510",
              color: "#FBF7EC",
              border: "none",
              borderRadius: 4,
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Searching…" : "Find Images"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ color: "#a33", background: "#fdeeee", padding: "8px 12px", borderRadius: 4, marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {results.length === 0 && !loading && !error && (
        <p style={{ color: "#888", fontSize: 14 }}>No results yet — search above.</p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginTop: 16 }}>
        {results.map((img) => {
          const isSaved = savedIds.has(img.external_id);
          return (
            <div
              key={img.external_id}
              style={{ border: "1px solid #ddd", borderRadius: 6, overflow: "hidden", background: "#fff" }}
            >
              <img
                src={img.thumbnail_url}
                alt={img.title}
                style={{ width: "100%", height: 150, objectFit: "cover", display: "block" }}
              />
              <div style={{ padding: 10, fontSize: 12, color: "#333" }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{img.licence}</div>
                <div style={{ color: "#666", marginBottom: 2 }}>{img.photographer}</div>
                <a
                  href={img.source_page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#55702A", fontSize: 11, display: "block", marginBottom: 8, wordBreak: "break-all" }}
                >
                  Source ↗
                </a>
                <button
                  onClick={() => handleApprove(img)}
                  disabled={isSaved || savingId === img.external_id}
                  style={{
                    width: "100%",
                    padding: "6px 0",
                    background: isSaved ? "#55702A" : "#D9A02B",
                    color: isSaved ? "#fff" : "#2E2510",
                    border: "none",
                    borderRadius: 4,
                    cursor: isSaved ? "default" : "pointer",
                    fontWeight: 600,
                  }}
                >
                  {isSaved ? "Saved ✓" : savingId === img.external_id ? "Saving…" : "Approve & Save"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
