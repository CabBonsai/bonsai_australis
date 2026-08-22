'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';

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
      <div className="mb-6">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-800">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold mt-2">Watering &amp; Misting Zones</h1>
        <p className="text-sm text-gray-500 mt-1">
          {trees.length} active trees. Change a tree&apos;s zone with the dropdown next to it.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {grouped.unassigned.length > 0 && (
        <ZoneSection
          title="Unassigned"
          description="No zone set yet."
          trees={grouped.unassigned}
          savingTree={savingTree}
          onChangeZone={updateZone}
        />
      )}

      {ZONES.map((zone) => (
        <ZoneSection
          key={zone}
          title={zone}
          description={ZONE_DESCRIPTIONS[zone]}
          trees={grouped.map[zone]}
          savingTree={savingTree}
          onChangeZone={updateZone}
        />
      ))}
    </div>
  );
}

function ZoneSection({
  title,
  description,
  trees,
  savingTree,
  onChangeZone,
}: {
  title: string;
  description: string;
  trees: Tree[];
  savingTree: number | null;
  onChangeZone: (treeNumber: number, newZone: string) => void;
}) {
  if (trees.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-baseline gap-2 mb-1">
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="text-xs text-gray-400">({trees.length})</span>
      </div>
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
              <tr key={t.tree_number} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono">{t.tree_number}</td>
                <td className="px-3 py-2 italic">{t.species ?? '—'}</td>
                <td className="px-3 py-2 text-gray-600">{t.common_name ?? '—'}</td>
                <td className="px-3 py-2">
                  <select
                    className="border rounded px-2 py-1 text-sm bg-white disabled:opacity-50"
                    value={t.watering_zone ?? ''}
                    disabled={savingTree === t.tree_number}
                    onChange={(e) => onChangeZone(t.tree_number, e.target.value)}
                  >
                    <option value="">— Unassigned —</option>
                    {ZONES.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                  {savingTree === t.tree_number && (
                    <span className="ml-2 text-xs text-gray-400">saving…</span>
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
