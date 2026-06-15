'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function SpeciesDetail() {
  const params = useParams()
  const spNo = params.sp_no

  const [species, setSpecies] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSpecies() {
      const { data, error } = await supabase
        .from('species')
        .select('*')
        .eq('sp_no', spNo)
        .single()

      if (error) {
        setError(error.message)
      } else {
        setSpecies(data)
      }
      setLoading(false)
    }
    fetchSpecies()
  }, [spNo])

  function updateField(field: string, value: any) {
    setSpecies({ ...species, [field]: value })
  }

  async function handleSave() {
    setSaving(true)
    setSaveMessage(null)

    const { error } = await supabase
      .from('species')
      .update({
        species: species.species,
        common_name: species.common_name,
        species_genus: species.species_genus,
        species_epithet: species.species_epithet,
        species_family: species.species_family,
        tree_type: species.tree_type,
        pure_species: species.pure_species,
        australian_native: species.australian_native,
        species_origin: species.species_origin,
        natural_habitat: species.natural_habitat,
        species_notes: species.species_notes,
        research_notes: species.research_notes,
      })
      .eq('sp_no', spNo)

    if (error) {
      setSaveMessage('Error: ' + error.message)
    } else {
      setSaveMessage('Saved!')
      setTimeout(() => setSaveMessage(null), 2000)
    }
    setSaving(false)
  }

  if (loading) return <div className="p-4">Loading...</div>
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>
  if (!species) return <div className="p-4">Species not found.</div>

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24">
      <Link href="/" className="text-blue-600 text-sm mb-4 inline-block">&larr; Back to list</Link>

      <h1 className="text-2xl font-bold">{species.species}</h1>
      <p className="text-sm text-gray-400 mb-4">sp_no: {species.sp_no}</p>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Quick Notes</label>
        <textarea
          value={species.research_notes || ''}
          onChange={(e) => updateField('research_notes', e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-base"
          rows={3}
          placeholder="Voice-to-text notes go here..."
        />
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold text-lg mb-2">Species Info</h2>

        <div>
          <label className="block text-sm font-medium mb-1">Species name</label>
          <input
            type="text"
            value={species.species || ''}
            onChange={(e) => updateField('species', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-base"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Common name</label>
          <input
            type="text"
            value={species.common_name || ''}
            onChange={(e) => updateField('common_name', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-base"
          />
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Genus</label>
            <input
              type="text"
              value={species.species_genus || ''}
              onChange={(e) => updateField('species_genus', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-base"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Epithet</label>
            <input
              type="text"
              value={species.species_epithet || ''}
              onChange={(e) => updateField('species_epithet', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-base"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Family</label>
          <input
            type="text"
            value={species.species_family || ''}
            onChange={(e) => updateField('species_family', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-base"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tree type</label>
          <input
            type="text"
            value={species.tree_type || ''}
            onChange={(e) => updateField('tree_type', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-base"
          />
        </div>

        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={species.pure_species || false}
              onChange={(e) => updateField('pure_species', e.target.checked)}
              className="w-4 h-4"
            />
            Pure species
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={species.australian_native || false}
              onChange={(e) => updateField('australian_native', e.target.checked)}
              className="w-4 h-4"
            />
            AU Native
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Origin</label>
          <input
            type="text"
            value={species.species_origin || ''}
            onChange={(e) => updateField('species_origin', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-base"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Natural habitat</label>
          <input
            type="text"
            value={species.natural_habitat || ''}
            onChange={(e) => updateField('natural_habitat', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-base"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Species notes</label>
          <textarea
            value={species.species_notes || ''}
            onChange={(e) => updateField('species_notes', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-base"
            rows={3}
          />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-between items-center max-w-2xl mx-auto">
        {saveMessage && <span className="text-sm">{saveMessage}</span>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="ml-auto bg-blue-600 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}