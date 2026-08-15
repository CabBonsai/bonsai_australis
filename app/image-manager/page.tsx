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
import Link from "next/link";

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

  // Manual entry — for images found by direct search (e.g. a specific
  // Wikimedia Commons file page located outside this tool) rather than
  // surfaced through the Openverse search above. Openverse indexes a lot of
  // Commons/Flickr content but not everything, and sometimes the exact
  // photo wanted (checked and confirmed license-clear by hand) just isn't
  // in its index under the search terms tried.
  const [manualOpen, setManualOpen] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [manualPhotographer, setManualPhotographer] = useState("");
  const [manualLicence, setManualLicence] = useState("");
  const [manualLicenceUrl, setManualLicenceUrl] = useState("");
  const [manualSource, setManualSource] = useState("");
  const [manualSourcePageUrl, setManualSourcePageUrl] = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  const [manualMessage, setManualMessage] = useState<string | null>(null);

  async function handleManualSave() {
    if (!spNo.trim()) {
      setManualMessage("Enter the sp_no this image belongs to (top field) first.");
      return;
    }
    if (!manualUrl.trim() || !manualLicence.trim() || !manualSourcePageUrl.trim()) {
      setManualMessage("Image URL, Licence, and Source Page URL are required.");
      return;
    }
    setManualSaving(true);
    setManualMessage(null);
    try {
      const res = await fetch("/api/species-images/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sp_no: Number(spNo),
          source_api: manualSource.trim() || "Manual",
          external_id: null,
          image_url: manualUrl.trim(),
          thumbnail_url: null,
          photographer: manualPhotographer.trim() || null,
          licence: manualLicence.trim(),
          licence_url: manualLicenceUrl.trim() || null,
          source_page_url: manualSourcePageUrl.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok && !data.duplicate) {
        setManualMessage(data.error || "Save failed.");
        return;
      }
      setManualMessage(data.duplicate ? "Already saved for this species." : "Saved — visible in that species' Photos section.");
      setManualUrl(""); setManualPhotographer(""); setManualLicence("");
      setManualLicenceUrl(""); setManualSource(""); setManualSourcePageUrl("");
    } catch {
      setManualMessage("Network error reaching the save endpoint.");
    } finally {
      setManualSaving(false);
    }
  }

  async function handleSearch() {
    if (!speciesName.trim()) {
      setError("Enter a species name to search.");
      return;
    }
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const res = await fetch(`/api/species-images/search?q=${encodeURIComponent(speciesName + " bonsai")}`);
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
      <Link href="/" style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}>&larr; Dashboard</Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "4px 0 4px" }}>Image Manager</h1>
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

      <div style={{ marginBottom: 24, border: "1px solid #e2dac2", borderRadius: 6, background: "#fffdf9" }}>
        <button
          onClick={() => setManualOpen(!manualOpen)}
          style={{
            width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 14px", background: "none", border: "none", cursor: "pointer",
            fontSize: 14, fontWeight: 600, color: "#3f5228", textAlign: "left",
          }}
        >
          Add an image found manually (not from Openverse search)
          <span style={{ fontSize: 16, color: "#8a7f5f" }}>{manualOpen ? "−" : "+"}</span>
        </button>
        {manualOpen && (
          <div style={{ padding: "0 14px 16px", fontSize: 13 }}>
            <p style={{ color: "#8a7f5f", marginBottom: 12 }}>
              Use this when you've found and license-checked a specific photo yourself
              (e.g. a Wikimedia Commons file page) that didn't turn up in the search above.
              Uses the sp_no entered at the top of the page. All fields except Photographer
              and Licence URL are required.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: 12, color: "#555", marginBottom: 4 }}>Image URL *</label>
                <input value={manualUrl} onChange={e => setManualUrl(e.target.value)} placeholder="Direct link to the full-size image file"
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#555", marginBottom: 4 }}>Photographer</label>
                <input value={manualPhotographer} onChange={e => setManualPhotographer(e.target.value)} placeholder="e.g. Geoff Derrin"
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#555", marginBottom: 4 }}>Licence *</label>
                <input value={manualLicence} onChange={e => setManualLicence(e.target.value)} placeholder="e.g. CC BY-SA 4.0"
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#555", marginBottom: 4 }}>Licence URL</label>
                <input value={manualLicenceUrl} onChange={e => setManualLicenceUrl(e.target.value)} placeholder="creativecommons.org/licenses/..."
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#555", marginBottom: 4 }}>Source name</label>
                <input value={manualSource} onChange={e => setManualSource(e.target.value)} placeholder="e.g. Wikimedia Commons"
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: 12, color: "#555", marginBottom: 4 }}>Source Page URL *</label>
                <input value={manualSourcePageUrl} onChange={e => setManualSourcePageUrl(e.target.value)} placeholder="The file's page (for the attribution link)"
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }} />
              </div>
            </div>
            {manualMessage && (
              <p style={{ color: manualMessage.startsWith("Saved") || manualMessage.startsWith("Already") ? "#3f5228" : "#a33", marginBottom: 10, fontWeight: 600 }}>
                {manualMessage}
              </p>
            )}
            <button
              onClick={handleManualSave}
              disabled={manualSaving}
              style={{
                padding: "9px 18px", background: "#D9A02B", color: "#2E2510", border: "none",
                borderRadius: 4, cursor: manualSaving ? "default" : "pointer", fontWeight: 600,
                opacity: manualSaving ? 0.6 : 1,
              }}
            >
              {manualSaving ? "Saving…" : "Save Manual Entry"}
            </button>
          </div>
        )}
      </div>

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
