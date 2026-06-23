'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

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

    const { data, error: insertError } = await supabase
      .from('species')
      .insert({
        species: form.species.trim(),
        common_name: form.common_name.trim() || 'Unknown',
        species_genus: form.species_genus.trim() || form.species.split(' ')[0],
        species_epithet: form.species_epithet.trim(),
        species_family: form.species_family.trim(),
        tree_type: form.tree_type.trim(),
        australian_native: form.australian_native,
        pure_species: form.pure_species,
        research_status: 'Not Started',
      })
      .select()
      .single()

    setSaving(false)

    if (insertError) {
      setError('Error creating species: ' + insertError.message)
      return
    }

    window.location.href = `/species/${data.sp_no}`
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
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 mt-4"
        >
          {saving ? 'Creating...' : 'Create Species'}
        </button>
      </div>
    </main>
  )
}
