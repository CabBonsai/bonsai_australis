'use client'

import { useState } from 'react'
export const dynamic = 'force-dynamic'

// Supporting tables seeded with a bare {sp_no} row right after species
// creation. Added [session 26 date] after finding that species created
// through this form (like every species added via migrate_species.py)
// were silently missing from all 7 of these tables - this form previously
// only ever wrote to the species table itself. Only sp_no is required on
// any of these tables; every other column defaults correctly (data_source
// -> 'Family Default', research_status -> 'Not Started', needs_verification
// -> true), so this produces the normal honest "not yet researched" state.
const SUPPORTING_TABLES = [
  'care_guide',
  'bonsai_suitability',
  'fertilisation',
  'pruning_protocols',
  'nebari_root',
  'seasonal_maintenance',
  'regional_suitability',
]

export default function NewSpeciesPage() {
  const [form, setForm] = useState({
    species: '',
    common_name: '',
    species_genus: '',
    species_epithet: '',
    species_family: '',
    tree_type: '',
    australian_native: false,
    pure_species: true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit() {
    if (!form.species.trim()) {
      setError('Scientific name is required')
      return
    }
    setSaving(true)
    setError('')

    const spNoRes = await fetch('/api/next-sp-no')
    if (!spNoRes.ok) {
      setSaving(false)
      setError('Could not determine next sp_no - try again')
      return
    }
    const { next_sp_no: nextSpNo } = await spNoRes.json()

    const res = await fetch('/api/admin-table', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'species',
        rows: [{
          sp_no: nextSpNo,
          species: form.species.trim(),
          common_name: form.common_name.trim() || 'Unknown',
          species_genus: form.species_genus.trim() || form.species.split(' ')[0],
          species_epithet: form.species_epithet.trim(),
          species_family: form.species_family.trim(),
          tree_type: form.tree_type.trim(),
          australian_native: form.australian_native,
          pure_species: form.pure_species,
          research_status: 'Not Started',
        }],
      }),
    })

    setSaving(false)

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      setError('Error creating species: ' + (errData.error || `Request failed (${res.status})`))
      return
    }

    const data = await res.json()
    const newSpNo = data[0].sp_no

    // Seed the 7 supporting tables so this species behaves normally in the
    // admin UI immediately, rather than silently missing rows until some
    // later fix pass finds the gap.
    await Promise.all(
      SUPPORTING_TABLES.map(table =>
        fetch('/api/admin-table', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table, rows: [{ sp_no: newSpNo }] }),
        }).catch(err => console.error(`Failed to seed ${table} for sp_no ${newSpNo}:`, err))
      )
    )

    window.location.href = `/species/${newSpNo}`
  }

  const inputClass = "w-full border rounded-lg px-3 py-2 text-base"

  return (
    <main className="max-w-xl mx-auto px-4 py-8">
      <a href="/" className="text-sm text-blue-600 block mb-6">← Back to species list</a>

      <h1 className="text-2xl font-bold mb-6">Add New Species</h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-500 mb-1">Scientific name <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={form.species}
            onChange={e => set('species', e.target.value)}
            placeholder="e.g. Eucalyptus camaldulensis"
            className={inputClass}
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm text-gray-500 mb-1">Common name</label>
          <input
            type="text"
            value={form.common_name}
            onChange={e => set('common_name', e.target.value)}
            placeholder="e.g. River red gum"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Genus</label>
            <input
              type="text"
              value={form.species_genus}
              onChange={e => set('species_genus', e.target.value)}
              placeholder="e.g. Eucalyptus"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Epithet</label>
            <input
              type="text"
              value={form.species_epithet}
              onChange={e => set('species_epithet', e.target.value)}
              placeholder="e.g. camaldulensis"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-500 mb-1">Family</label>
          <input
            type="text"
            value={form.species_family}
            onChange={e => set('species_family', e.target.value)}
            placeholder="e.g. Myrtaceae"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-500 mb-1">Tree type</label>
          <select value={form.tree_type} onChange={e => set('tree_type', e.target.value)} className={inputClass}>
            <option value="">Select...</option>
            <option value="tree">Tree</option>
            <option value="shrub">Shrub</option>
            <option value="conifer">Conifer</option>
            <option value="palm">Palm</option>
            <option value="grass tree">Grass tree</option>
            <option value="vine">Vine</option>
            <option value="succulent">Succulent</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="flex gap-6 pt-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.australian_native}
              onChange={e => set('australian_native', e.target.checked)}
              className="w-4 h-4"
            />
            AU Native
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.pure_species}
              onChange={e => set('pure_species', e.target.checked)}
              className="w-4 h-4"
            />
            Pure species
          </label>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
  onClick={handleSubmit}
  disabled={saving}
  style={{ width: '100%', background: saving ? '#93c5fd' : '#2563eb', color: 'white', padding: '12px', borderRadius: '8px', fontWeight: '600', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', marginTop: '16px' }}
>
          {saving ? 'Creating...' : 'Create Species'}
        </button>
      </div>
    </main>
  )
}
