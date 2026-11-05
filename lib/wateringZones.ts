// lib/wateringZones.ts
//
// Single source of truth for watering zones.
//
// The collection.watering_zone column stores the descriptive name (for example
// 'Moderate-High'). The letter (Zone A-H) is a display convention only: it is
// worked out from the position of the name in ZONES below (A = first, B = second,
// and so on), so re-ordering ZONES re-letters every page that uses this file.
//
// Used by: the Watering Zones page, the collection list, and the tree detail page.
// The /api/watering-zones route keeps its own list of valid names for validation.

export const ZONES = [
  'Permanent Water Tray',
  'Frequent/Daily Watering',
  'Moderate-High',
  'Standard/Moderate',
  'Moderate-Drought',
  'Low-Moderate',
  'Low Water/Drought-Tolerant',
  'Isolate - Overwater/Rot Risk',
] as const

export const ZONE_CODES: Record<string, string> = Object.fromEntries(
  ZONES.map((zone, i) => [zone, String.fromCharCode(65 + i)]) // A, B, C, ...
)

export const ZONE_DESCRIPTIONS: Record<string, string> = {
  'Permanent Water Tray': 'Confirmed to tolerate sitting in a permanent water tray.',
  'Frequent/Daily Watering': 'Declines quickly if allowed to dry out — not confirmed tray-safe.',
  'Moderate-High': 'Regular rhythm, leaning toward more frequent.',
  'Standard/Moderate': 'Normal bonsai watering rhythm.',
  'Moderate-Drought': 'Regular rhythm, leaning toward more drying between waterings.',
  'Low-Moderate': 'Tolerant of some drying.',
  'Low Water/Drought-Tolerant': 'Risk here is overwatering, not underwatering.',
  'Isolate - Overwater/Rot Risk': 'Real, sourced overwatering/root-rot failure mode — keep physically separate.',
}

// Misting guidance for a hot-afternoon misting system (a backup to hand watering, not a
// replacement for root watering). Derived from the zone plus a few species cautions in the
// Watering & Misting Zone Guide; it is not stored in the database, so it follows zone changes.
//   ok       - zones A-C (moisture-loving): fine to mist
//   optional - zone D: harmless but little benefit
//   flowers  - mist foliage but keep flowers dry (Callistemon)
//   no       - zones E-H, unassigned, or a species caution
export type MistLevel = 'ok' | 'optional' | 'flowers' | 'no'

export type MistStatus = { level: MistLevel; label: string; reason: string }

const MIST_SPECIES_CAUTIONS: { test: RegExp; reason: string }[] = [
  { test: /^banksia\b/i, reason: 'Banksia: avoid mist near the roots' },
  { test: /^melaleuca fulgens\b/i, reason: 'Needs good drainage and is prone to fungal disease' },
  { test: /^brachychiton\b/i, reason: 'Overwatering caution (genus pattern)' },
]

export function mistStatus(
  zone: string | null | undefined,
  species: string | null | undefined,
  displayName?: string | null
): MistStatus {
  const letter = zoneLetter(zone)
  if (!letter) return { level: 'no', label: 'No mist', reason: 'Set a zone first' }

  const name = (species && species.trim()) || (displayName && displayName.trim()) || ''
  const caution = MIST_SPECIES_CAUTIONS.find((c) => c.test.test(name))
  if (caution) return { level: 'no', label: 'No mist', reason: caution.reason }

  if (letter === 'A' || letter === 'B' || letter === 'C') {
    if (/^callistemon\b/i.test(name)) {
      return { level: 'flowers', label: 'Mist, flowers dry', reason: 'Keep flowers dry while in bloom' }
    }
    return { level: 'ok', label: 'Mist OK', reason: 'Moisture-loving zone' }
  }
  if (letter === 'D') return { level: 'optional', label: 'Optional', reason: 'Little benefit, little harm' }
  return { level: 'no', label: 'No mist', reason: 'Dry-leaning or isolate zone' }
}

// Letter for a stored zone name, or null when the tree has no zone (or an unknown one).
export function zoneLetter(zone: string | null | undefined): string | null {
  if (!zone) return null
  return ZONE_CODES[zone] ?? null
}
