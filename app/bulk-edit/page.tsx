'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

type FieldType = 'text' | 'number' | 'bool'

interface TableConfig {
  label: string
  table: string
  columns: string[]
  types: Record<string, FieldType>
}

const TABLES: Record<string, TableConfig> = {
  species: {
    label: 'Species',
    table: 'species',
    columns: ['sp_no', 'species', 'pure_species', 'species_epithet', 'cultivar', 'species_genus', 'common_name', 'species_family', 'tree_type', 'australian_native', 'species_origin', 'species_notes', 'natural_habitat', 'image_url'],
    types: {
      sp_no: 'number', species: 'text', pure_species: 'bool', species_epithet: 'text',
      cultivar: 'text', species_genus: 'text', common_name: 'text', species_family: 'text',
      tree_type: 'text', australian_native: 'bool', species_origin: 'text',
      species_notes: 'text', natural_habitat: 'text', image_url: 'text',
    },
  },
  variants: {
    label: 'Variants',
    table: 'variants',
    columns: ['sp_no', 'parent_sp_no', 'variant_name', 'common_name', 'rating', 'variant_type', 'botanical_rank', 'is_hybrid', 'hybrid_parent_1', 'hybrid_parent_2', 'notes', 'species_origin', 'natural_habitat', 'species_notes', 'image_url'],
    types: {
      sp_no: 'number', parent_sp_no: 'number', variant_name: 'text', common_name: 'text',
      rating: 'text', variant_type: 'text', botanical_rank: 'text', is_hybrid: 'bool',
      hybrid_parent_1: 'text', hybrid_parent_2: 'text', notes: 'text',
      species_origin: 'text', natural_habitat: 'text', species_notes: 'text', image_url: 'text',
    },
  },
}

function coerce(raw: string, type: FieldType): any {
  const trimmed = (raw ?? '').trim()
  if (type === 'number') {
    if (trimmed === '') return null
    const n = Number(trimmed)
    return isNaN(n) ? null : n
  }
  if (type === 'bool') {
    const upper = trimmed.toUpperCase()
    if (upper === 'TRUE' || upper === '1') return true
    if (upper === 'FALSE' || upper === '0') return false
    return null
  }
  return trimmed === '' ? null : trimmed
}

function formatCell(v: any): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  return String(v)
}

export default function BulkEditPage() {
  const [activeTab, setActiveTab] = useState<string>('species')
  const [tsvText, setTsvText] = useState('')
  const [parsedRows, setParsedRows] = useState<any[]>([])
  const [existingMap, setExistingMap] = useState<Record<number, any>>({})
  const [parseError, setParseError] = useState('')
  const [checking, setChecking] = useState(false)
  const [applying, setApplying] = useState(false)
  const [skipBlanks, setSkipBlanks] = useState(true)
  const [result, setResult] = useState('')
  const [copied, setCopied] = useState(false)

  const config = TABLES[activeTab]

  function switchTab(tab: string) {
    setActiveTab(tab)
    setTsvText('')
    setParsedRows([])
    setExistingMap({})
    setParseError('')
    setResult('')
  }

  function copyHeaderTemplate() {
    navigator.clipboard.writeText(config.columns.join('\t'))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function handlePreview() {
    setParseError('')
    setResult('')
    const lines = tsvText.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim() !== '')
    if (lines.length === 0) {
      setParseError('Paste some TSV rows first.')
      return
    }

    const rows: any[] = []
    for (let i = 0; i < lines.length; i++) {
      const cells = lines[i].split('\t')
      if (cells.length !== config.columns.length) {
        setParseError(`Row ${i + 1} has ${cells.length} columns, expected ${config.columns.length}. Check for missing tabs or an extra column.`)
        return
      }
      const rowObj: any = {}
      config.columns.forEach((col, idx) => {
        rowObj[col] = coerce(cells[idx], config.types[col])
      })
      if (rowObj.sp_no === null) {
        setParseError(`Row ${i + 1} is missing a valid sp_no.`)
        return
      }
      rows.push(rowObj)
    }

    setChecking(true)
    const spNos = rows.map(r => r.sp_no)
    const { data, error } = await supabase
      .from(config.table)
      .select('*')
      .in('sp_no', spNos)
    setChecking(false)

    if (error) {
      setParseError('Error checking existing rows: ' + error.message)
      return
    }

    const map: Record<number, any> = {}
    ;(data || []).forEach((r: any) => { map[r.sp_no] = r })
    setExistingMap(map)
    setParsedRows(rows)
  }

  async function handleApply() {
    setApplying(true)
    setResult('')

    const upsertRows = parsedRows.map(row => {
      const existing = existingMap[row.sp_no]
      if (!existing) return row
      if (!skipBlanks) return row
      const merged: any = { sp_no: row.sp_no }
      config.columns.forEach(col => {
        if (col === 'sp_no') return
        merged[col] = row[col] !== null ? row[col] : existing[col]
      })
      return merged
    })

    const { error } = await supabase
      .from(config.table)
      .upsert(upsertRows, { onConflict: 'sp_no' })

    setApplying(false)

    if (error) {
      setResult('Error applying changes: ' + error.message)
      return
    }

    setResult(`Successfully applied ${upsertRows.length} row(s) to ${config.label}.`)
    setTsvText('')
    setParsedRows([])
    setExistingMap({})
  }

  const inputStyle = { width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', fontFamily: 'monospace', boxSizing: 'border-box' as const }

  return (
    <main style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}>
      <a href="/" style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none', display: 'block', marginBottom: '8px' }}>&larr; Admin Home</a>
      <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 16px' }}>Bulk Edit</h1>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {Object.keys(TABLES).map(key => (
          <button
            key={key}
            onClick={() => switchTab(key)}
            style={{
              padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: '600',
              border: activeTab === key ? '1px solid #2563eb' : '1px solid #e2e8f0',
              background: activeTab === key ? '#2563eb' : '#fff',
              color: activeTab === key ? '#fff' : '#374151',
              cursor: 'pointer',
            }}
          >
            {TABLES[key].label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', color: '#6b7280' }}>
          Paste TSV — no header row, columns in this order:
        </span>
        <button
          onClick={copyHeaderTemplate}
          style={{ fontSize: '12px', padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#f9fafb', cursor: 'pointer', color: '#374151' }}
        >
          {copied ? 'Copied!' : 'Copy Header Template'}
        </button>
      </div>
      <p style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace', marginBottom: '8px', wordBreak: 'break-all' }}>
        {config.columns.join(' | ')}
      </p>

      <textarea
        value={tsvText}
        onChange={e => setTsvText(e.target.value)}
        placeholder="Paste TSV rows here..."
        rows={8}
        style={{ ...inputStyle, marginBottom: '12px' }}
      />

      {parseError && (
        <p style={{ color: '#dc2626', fontSize: '13px', marginBottom: '12px' }}>{parseError}</p>
      )}

      <button
        onClick={handlePreview}
        disabled={checking}
        style={{ background: checking ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: '600', cursor: checking ? 'not-allowed' : 'pointer', marginBottom: '16px' }}
      >
        {checking ? 'Checking...' : 'Preview Diff'}
      </button>

      {parsedRows.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '12px' }}>
            <input type="checkbox" checked={skipBlanks} onChange={e => setSkipBlanks(e.target.checked)} />
            Skip blank cells (don't overwrite existing data with empty values)
          </label>

          {parsedRows.map(row => {
            const existing = existingMap[row.sp_no]
            const isNew = !existing
            return (
              <div key={row.sp_no} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontWeight: '700', fontSize: '14px' }}>sp_no {row.sp_no}</span>
                  <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', background: isNew ? '#dcfce7' : '#fef3c7', color: isNew ? '#16a34a' : '#b45309' }}>
                    {isNew ? 'NEW' : 'UPDATE'}
                  </span>
                </div>
                {!isNew && (
                  <div style={{ fontSize: '12px' }}>
                    {config.columns.filter(col => col !== 'sp_no' && row[col] !== null && row[col] !== existing[col]).map(col => (
                      <div key={col} style={{ display: 'flex', gap: '8px', padding: '2px 0', borderTop: '1px solid #f1f5f9' }}>
                        <span style={{ color: '#6b7280', minWidth: '140px' }}>{col}</span>
                        <span style={{ color: '#dc2626', textDecoration: 'line-through' }}>{formatCell(existing[col])}</span>
                        <span style={{ color: '#16a34a' }}>&rarr; {formatCell(row[col])}</span>
                      </div>
                    ))}
                    {config.columns.filter(col => col !== 'sp_no' && row[col] !== null && row[col] !== existing[col]).length === 0 && (
                      <p style={{ color: '#9ca3af' }}>No changes to existing data.</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          <button
            onClick={handleApply}
            disabled={applying}
            style={{ width: '100%', background: applying ? '#86efac' : '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '15px', fontWeight: '700', cursor: applying ? 'not-allowed' : 'pointer', marginTop: '8px' }}
          >
            {applying ? 'Applying...' : `Apply ${parsedRows.length} Row(s) to ${config.label}`}
          </button>
        </div>
      )}

      {result && (
        <p style={{ fontSize: '14px', color: result.startsWith('Error') ? '#dc2626' : '#16a34a', marginTop: '12px' }}>{result}</p>
      )}
    </main>
  )
}