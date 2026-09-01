'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';

// Formal zone names (Zone A-H) are a display-layer convention only — the underlying
// collection.watering_zone column still stores the original descriptive label
// ('Permanent Water Tray', etc.), unchanged. ZONES order below is the source of
// truth for both the letter assignment (A = index 0) and the on-page top-to-bottom
// order, so re-ordering this array re-letters everything automatically.
const ZONES = [
  'Permanent Water Tray',
  'Frequent/Daily Watering',
  'Moderate-High',
  'Standard/Moderate',
  'Moderate-Drought',
  'Low-Moderate',
  'Low Water/Drought-Tolerant',
  'Isolate - Overwater/Rot Risk',
] as const;

const ZONE_CODES: Record<string, string> = Object.fromEntries(
  ZONES.map((zone, i) => [zone, String.fromCharCode(65 + i)]) // A, B, C, ...
);

const ZONE_DESCRIPTIONS: Record<string, string> = {
  'Permanent Water Tray': 'Confirmed to tolerate sitting in a permanent water tray.',
  'Frequent/Daily Watering': 'Declines quickly if allowed to dry out — not confirmed tray-safe.',
  'Moderate-High': 'Regular rhythm, leaning toward more frequent.',
  'Standard/Moderate': 'Normal bonsai watering rhythm.',
  'Moderate-Drought': 'Regular rhythm, leaning toward more drying between waterings.',
  'Low-Moderate': 'Tolerant of some drying.',
  'Low Water/Drought-Tolerant': 'Risk here is overwatering, not underwatering.',
  'Isolate - Overwater/Rot Risk': 'Real, sourced overwatering/root-rot failure mode — keep physically separate.',
};

type Tree = {
  tree_number: number;
  display_name: string | null;
  watering_zone: string | null;
  sp_no: number;
  species: string | null;
  common_name: string | null;
};

export default function WateringZonesPage() {
  const [trees, setTrees] = useState<Tree[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingTree, setSavingTree] = useState<number | null>(null);

  useEffect(() => {
    fetchTrees();
  }, []);

  // Printed sheet always needs today's date in the header (walking the collection
  // with a paper copy, not a screen) - set once on mount rather than on every render.
  const [printDate] = useState(() =>
    new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  );

  async function fetchTrees() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/watering-zones');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load trees');
      setTrees(json.trees);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateZone(treeNumber: number, newZone: string) {
    setSavingTree(treeNumber);
    const zoneValue = newZone === '' ? null : newZone;
    // optimistic update
    setTrees((prev) =>
      prev.map((t) => (t.tree_number === treeNumber ? { ...t, watering_zone: zoneValue } : t))
    );
    try {
      const res = await fetch('/api/watering-zones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tree_number: treeNumber, watering_zone: zoneValue }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update zone');
    } catch (e: any) {
      setError(e.message);
      // revert on failure
      fetchTrees();
    } finally {
      setSavingTree(null);
    }
  }

  function printZones() {
    setTimeout(() => window.print(), 50);
  }

  const grouped = useMemo(() => {
    const map: Record<string, Tree[]> = {};
    for (const zone of ZONES) map[zone] = [];
    const unassigned: Tree[] = [];
    for (const t of trees) {
      if (t.watering_zone && map[t.watering_zone]) {
        map[t.watering_zone].push(t);
      } else {
        unassigned.push(t);
      }
    }
    return { map, unassigned };
  }, [trees]);

  if (loading) {
    return <div className="p-8 text-sm text-gray-500">Loading watering zones…</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6 no-print">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-800">
          ← Dashboard
        </Link>
        <div className="flex items-center justify-between mt-2">
          <h1 className="text-2xl font-semibold">Watering &amp; Misting Zones</h1>
          <button
            onClick={printZones}
            className="text-sm border rounded px-3 py-1.5 bg-white hover:bg-gray-50"
          >
            Print / Save as PDF
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {trees.length} active trees. Change a tree&apos;s zone with the dropdown next to it.
        </p>
      </div>

      {/* Print-only header: screen users already have the title above; the printed
          sheet needs a date stamp since it's meant to be carried around, not viewed live. */}
      <div className="hidden print-block mb-4">
        <h1 className="text-xl font-semibold">Watering &amp; Misting Zones</h1>
        <p className="text-xs text-gray-600">{printDate}</p>
      </div>

      {/* Zone key — quick reference for the letter labels, most useful on the printed
          sheet but left visible on screen too so it isn't a print-only surprise. */}
      <div className="mb-6 border rounded-lg p-3 bg-gray-50 zone-key">
        <div className="text-xs font-medium text-gray-500 uppercase mb-2">Zone key</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs text-gray-700">
          {ZONES.map((zone) => (
            <div key={zone}>
              <span className="font-semibold">Zone {ZONE_CODES[zone]}</span> — {zone}
            </div>
          ))}
          <div>
            <span className="font-semibold">Unassigned</span> — no zone set yet
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 no-print">
          {error}
        </div>
      )}

      {ZONES.map((zone) => (
        <ZoneSection
          key={zone}
          code={ZONE_CODES[zone]}
          heading={zone}
          description={ZONE_DESCRIPTIONS[zone]}
          trees={grouped.map[zone]}
          savingTree={savingTree}
          onChangeZone={updateZone}
        />
      ))}

      {grouped.unassigned.length > 0 && (
        <ZoneSection
          code={null}
          heading="Unassigned"
          description="No zone set yet."
          trees={grouped.unassigned}
          savingTree={savingTree}
          onChangeZone={updateZone}
        />
      )}

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-block {
            display: block !important;
          }
          .zone-heading {
            break-after: avoid;
          }
          /* Deliberately NOT break-inside:avoid on .zone-section as a whole - Standard/
             Moderate alone runs 50+ trees, and Chrome's known behaviour when it can't
             satisfy an avoid-break on tall content is to silently stop rendering the
             rest of the document (same failure mode hit and fixed in Booklet Studio).
             Row-level avoid below is the safe, atomic version of the same idea. */
          .zone-row {
            break-inside: avoid;
          }
          @page {
            margin: 0.6in;
          }
        }
      `}</style>
    </div>
  );
}

function ZoneSection({
  code,
  heading,
  description,
  trees,
  savingTree,
  onChangeZone,
}: {
  code: string | null;
  heading: string;
  description: string;
  trees: Tree[];
  savingTree: number | null;
  onChangeZone: (treeNumber: number, newZone: string) => void;
}) {
  if (trees.length === 0) return null;

  return (
    <div className="mb-8 zone-section">
      <div className="flex items-baseline gap-2 mb-0.5 zone-heading">
        <h2 className="text-lg font-bold">{code ? `Zone ${code}` : 'Unassigned'}</h2>
        <span className="text-xs text-gray-400">({trees.length})</span>
      </div>
      {/* Existing descriptive label retained as a sub-heading under the new formal name. */}
      <h3 className="text-sm font-medium text-gray-600 mb-1">{heading}</h3>
      <p className="text-xs text-gray-500 mb-3">{description}</p>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">Tree #</th>
              <th className="px-3 py-2 font-medium">Species</th>
              <th className="px-3 py-2 font-medium">Common Name</th>
              <th className="px-3 py-2 font-medium">Zone</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {trees.map((t) => (
              <tr key={t.tree_number} className="hover:bg-gray-50 zone-row">
                <td className="px-3 py-2 font-mono">{t.tree_number}</td>
                <td className="px-3 py-2 italic">{t.species ?? '—'}</td>
                <td className="px-3 py-2 text-gray-600">{t.common_name ?? '—'}</td>
                <td className="px-3 py-2">
                  {/* Screen: editable dropdown. Print: plain text - a live <select>
                      prints inconsistently across browsers and there's nothing to
                      edit on a paper sheet anyway. */}
                  <select
                    className="border rounded px-2 py-1 text-sm bg-white disabled:opacity-50 no-print"
                    value={t.watering_zone ?? ''}
                    disabled={savingTree === t.tree_number}
                    onChange={(e) => onChangeZone(t.tree_number, e.target.value)}
                  >
                    <option value="">— Unassigned —</option>
                    {ZONES.map((z) => (
                      <option key={z} value={z}>
                        Zone {ZONE_CODES[z]} — {z}
                      </option>
                    ))}
                  </select>
                  <span className="hidden print-block text-xs">
                    {code ? `Zone ${code}` : 'Unassigned'}
                  </span>
                  {savingTree === t.tree_number && (
                    <span className="ml-2 text-xs text-gray-400 no-print">saving…</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
