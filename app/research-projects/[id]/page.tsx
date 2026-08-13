'use client'

import { useState, useEffect, use as usePromise } from 'react'
import { supabase } from '@/lib/supabase'

const statusColor: Record<string, string> = {
  active: '#16a34a',
  completed: '#2563eb',
  abandoned: '#6b7280',
}

const STATUS_OPTIONS = ['active', 'completed', 'abandoned']

export default function ResearchProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params)
  const projectId = parseInt(id, 10)

  const [project, setProject] = useState<any>(null)
  const [trees, setTrees] = useState<any[]>([])
  const [journal, setJournal] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingBaselineId, setEditingBaselineId] = useState<number | null>(null)
  const [baselineCaliper, setBaselineCaliper] = useState('')
  const [baselineHeight, setBaselineHeight] = useState('')
  const [baselineNotes, setBaselineNotes] = useState('')
  const [savingBaseline, setSavingBaseline] = useState(false)

  // Measurement log — separate from baseline on purpose. Baseline (above) is
  // written exactly once, the true first-ever reading. Every check-in after
  // that goes here as its own dated row in research_project_measurements, so
  // Save never overwrites prior history the way the old single-form flow did.
  const [measurements, setMeasurements] = useState<Record<number, any[]>>({})
  const [loggingTreeId, setLoggingTreeId] = useState<number | null>(null)
  const [editingMeasurementId, setEditingMeasurementId] = useState<number | null>(null)
  const [measDate, setMeasDate] = useState(new Date().toISOString().slice(0, 10))
  const [measCaliper, setMeasCaliper] = useState('')
  const [measHeight, setMeasHeight] = useState('')
  const [measNotes, setMeasNotes] = useState('')
  const [savingMeasurement, setSavingMeasurement] = useState(false)
  const [deletingMeasurementId, setDeletingMeasurementId] = useState<number | null>(null)
  const [generatingReport, setGeneratingReport] = useState(false)

  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10))
  const [entryTreeId, setEntryTreeId] = useState<string>('') // '' = pod-wide
  const [entryNote, setEntryNote] = useState('')
  const [entryPhotoUrl, setEntryPhotoUrl] = useState('')
  const [savingEntry, setSavingEntry] = useState(false)

  // Project header edit mode — previously the title/status/hypothesis/methodology/
  // dates block had no edit path at all once a project was created (only baseline
  // and journal entries had add/edit flows). This mirrors that same pattern.
  const [editingHeader, setEditingHeader] = useState(false)
  const [headerTitle, setHeaderTitle] = useState('')
  const [headerStatus, setHeaderStatus] = useState('')
  const [headerHypothesis, setHeaderHypothesis] = useState('')
  const [headerMethodology, setHeaderMethodology] = useState('')
  const [headerStartDate, setHeaderStartDate] = useState('')
  const [headerEndDate, setHeaderEndDate] = useState('')
  const [savingHeader, setSavingHeader] = useState(false)

  // Tree link edit mode — schedule fields on the research_project_trees row
  // itself (next_measurement_date, measurement_interval_days). Not the
  // species/collection/tubestock link — that's set at add-time and changing
  // it is a re-link, not an edit, so it's deliberately out of scope here.
  const [editingTreeId, setEditingTreeId] = useState<number | null>(null)
  const [treeNextMeasDate, setTreeNextMeasDate] = useState('')
  const [treeMeasIntervalDays, setTreeMeasIntervalDays] = useState('')
  const [savingTreeEdit, setSavingTreeEdit] = useState(false)
  const [removingTreeId, setRemovingTreeId] = useState<number | null>(null)

  useEffect(() => { if (projectId) fetchAll() }, [projectId])

  async function fetchAll() {
    setLoading(true)

    const projectRes = await fetch(`/api/research-projects?id=${projectId}`)
    const projectRows = await projectRes.json()

    if (!projectRes.ok) {
      setError(projectRows.error || 'Failed to load project')
      setLoading(false)
      return
    }
    const projectData = Array.isArray(projectRows) ? projectRows[0] : projectRows
    setProject(projectData)

    const treesRes = await fetch(`/api/research-project-trees?project_id=${projectId}`)
    const treeRows = treesRes.ok ? await treesRes.json() : []

    const treeLinks = treeRows || []
    const collectionIds = treeLinks.map((t: any) => t.collection_id).filter(Boolean)
    const tubestockIds = treeLinks.map((t: any) => t.tubestock_id).filter(Boolean)
    let collectionMap: Record<string, any> = {}
    let tubestockMap: Record<number, any> = {}
    let speciesMap: Record<number, string> = {}
    const spNosNeeded = new Set<number>()

    if (collectionIds.length > 0) {
      const { data: collectionData } = await supabase
        .from('collection')
        .select('collection_id, display_name, tree_name, sp_no, image_url')
        .in('collection_id', collectionIds)
      ;(collectionData || []).forEach((c: any) => {
        collectionMap[c.collection_id] = c
        if (c.sp_no) spNosNeeded.add(c.sp_no)
      })
    }

    if (tubestockIds.length > 0) {
      const tubestockRes = await fetch('/api/tubestock')
      const allTubestock = tubestockRes.ok ? await tubestockRes.json() : []
      const idSet = new Set(tubestockIds)
      ;(allTubestock || [])
        .filter((t: any) => idSet.has(t.id))
        .forEach((t: any) => {
          tubestockMap[t.id] = t
          if (t.sp_no) spNosNeeded.add(t.sp_no)
        })
    }

    if (spNosNeeded.size > 0) {
      const { data: spData } = await supabase.from('species').select('sp_no, species, common_name').in('sp_no', Array.from(spNosNeeded))
      ;(spData || []).forEach((s: any) => {
        speciesMap[s.sp_no] = s.species + (s.common_name && s.common_name !== 'Unknown' ? ' \u2014 ' + s.common_name : '')
      })
    }

    setTrees(treeLinks.map((t: any) => {
      if (t.collection_id && collectionMap[t.collection_id]) {
        const c = collectionMap[t.collection_id]
        return {
          ...t,
          displayName: c.display_name || c.tree_name || 'Unnamed tree',
          speciesLabel: speciesMap[c.sp_no] || '',
          imageUrl: c.image_url || null,
          sourceLabel: null,
        }
      }
      if (t.tubestock_id && tubestockMap[t.tubestock_id]) {
        const ts = tubestockMap[t.tubestock_id]
        return {
          ...t,
          displayName: (ts.tubestock_number ? ts.tubestock_number + ' \u2014 ' : '') + (speciesMap[ts.sp_no] || ts.species_name_text || 'Unnamed'),
          speciesLabel: speciesMap[ts.sp_no] || ts.species_name_text || '',
          imageUrl: null,
          sourceLabel: ts.source || null,
        }
      }
      return { ...t, displayName: 'Unlinked entry', speciesLabel: '', imageUrl: null, sourceLabel: null }
    }))

    if (treeLinks.length > 0) {
      const measEntries = await Promise.all(
        treeLinks.map((t: any) =>
          fetch(`/api/research-project-measurements?project_tree_id=${t.id}`)
            .then(r => (r.ok ? r.json() : []))
            .then(rows => [t.id, rows || []] as [number, any[]])
        )
      )
      setMeasurements(Object.fromEntries(measEntries))
    } else {
      setMeasurements({})
    }

    const journalRes = await fetch(`/api/research-project-journal?project_id=${projectId}`)
    const journalRows = journalRes.ok ? await journalRes.json() : []

    const sortedJournal = (journalRows || []).slice().sort((a: any, b: any) => {
      if (a.entry_date < b.entry_date) return 1
      if (a.entry_date > b.entry_date) return -1
      return 0
    })

    setJournal(sortedJournal.map((j: any) => {
      const c = j.collection_id ? collectionMap[j.collection_id] : null
      return { ...j, treeName: c ? (c.display_name || c.tree_name) : null }
    }))

    setError(null)
    setLoading(false)
  }

  function openHeaderEditor() {
    setHeaderTitle(project.title || '')
    setHeaderStatus(project.status || 'active')
    setHeaderHypothesis(project.hypothesis || '')
    setHeaderMethodology(project.methodology || '')
    setHeaderStartDate(project.start_date || '')
    setHeaderEndDate(project.end_date || '')
    setEditingHeader(true)
  }

  async function handleSaveHeader() {
    setSavingHeader(true)
    const res = await fetch('/api/research-projects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: projectId,
        title: headerTitle.trim(),
        status: headerStatus,
        hypothesis: headerHypothesis.trim() || null,
        methodology: headerMethodology.trim() || null,
        start_date: headerStartDate || null,
        end_date: headerEndDate || null,
      }),
    })
    const data = await res.json()
    setSavingHeader(false)
    if (!res.ok) {
      alert('Error saving: ' + data.error)
      return
    }
    setEditingHeader(false)
    fetchAll()
  }

  function openBaselineEditor(t: any) {
    setEditingBaselineId(t.id)
    setBaselineCaliper(t.baseline_caliper_mm ?? '')
    setBaselineHeight(t.baseline_height_mm ?? '')
    setBaselineNotes(t.baseline_notes || '')
  }

  async function handleSaveBaseline(treeRowId: number) {
    setSavingBaseline(true)
    await fetch('/api/research-project-trees', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: treeRowId,
        baseline_date: new Date().toISOString().slice(0, 10),
        baseline_caliper_mm: baselineCaliper === '' ? null : parseFloat(baselineCaliper),
        baseline_height_mm: baselineHeight === '' ? null : parseFloat(baselineHeight),
        baseline_notes: baselineNotes || null,
      }),
    })
    setSavingBaseline(false)
    setEditingBaselineId(null)
    fetchAll()
  }

  function openTreeEditor(t: any) {
    setEditingTreeId(t.id)
    setTreeNextMeasDate(t.next_measurement_date || '')
    setTreeMeasIntervalDays(t.measurement_interval_days ?? '')
  }

  async function handleSaveTreeEdit(treeRowId: number) {
    setSavingTreeEdit(true)
    const res = await fetch('/api/research-project-trees', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: treeRowId,
        next_measurement_date: treeNextMeasDate || null,
        measurement_interval_days: treeMeasIntervalDays === '' ? null : parseInt(treeMeasIntervalDays, 10),
      }),
    })
    const data = await res.json()
    setSavingTreeEdit(false)
    if (!res.ok) {
      alert('Error saving: ' + data.error)
      return
    }
    setEditingTreeId(null)
    fetchAll()
  }

  async function handleRemoveTree(treeRowId: number, displayName: string) {
    if (!confirm(`Remove "${displayName}" from this research project? This only unlinks it from the project — the tree itself (in Collection or Tubestock) is not affected, and its baseline/measurement history will be deleted along with the link.`)) {
      return
    }
    setRemovingTreeId(treeRowId)
    const res = await fetch(`/api/research-project-trees?id=${treeRowId}`, { method: 'DELETE' })
    const data = await res.json()
    setRemovingTreeId(null)
    if (!res.ok) {
      alert('Error removing: ' + data.error)
      return
    }
    fetchAll()
  }

  function openMeasurementLogger(treeRowId: number) {
    setLoggingTreeId(treeRowId)
    setEditingMeasurementId(null)
    setMeasDate(new Date().toISOString().slice(0, 10))
    setMeasCaliper('')
    setMeasHeight('')
    setMeasNotes('')
  }

  function openMeasurementEditor(treeRowId: number, m: any) {
    setLoggingTreeId(treeRowId)
    setEditingMeasurementId(m.id)
    setMeasDate(m.measurement_date || '')
    setMeasCaliper(m.caliper_mm ?? '')
    setMeasHeight(m.height_mm ?? '')
    setMeasNotes(m.notes || '')
  }

  async function handleSaveMeasurement(treeRowId: number) {
    setSavingMeasurement(true)
    const payload: any = {
      measurement_date: measDate,
      caliper_mm: measCaliper === '' ? null : parseFloat(measCaliper),
      height_mm: measHeight === '' ? null : parseFloat(measHeight),
      notes: measNotes || null,
    }
    let res
    if (editingMeasurementId) {
      // Correcting a mis-entered reading, not logging a new check-in.
      res = await fetch('/api/research-project-measurements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingMeasurementId, ...payload }),
      })
    } else {
      payload.project_tree_id = treeRowId
      res = await fetch('/api/research-project-measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }
    const data = await res.json()
    setSavingMeasurement(false)
    if (!res.ok) {
      alert('Error saving measurement: ' + data.error)
      return
    }
    setLoggingTreeId(null)
    setEditingMeasurementId(null)
    fetchAll()
  }

  async function handleDeleteMeasurement(measurementId: number) {
    if (!confirm('Delete this measurement entry? This cannot be undone.')) return
    setDeletingMeasurementId(measurementId)
    const res = await fetch(`/api/research-project-measurements?id=${measurementId}`, { method: 'DELETE' })
    const data = await res.json()
    setDeletingMeasurementId(null)
    if (!res.ok) {
      alert('Error deleting: ' + data.error)
      return
    }
    fetchAll()
  }

  async function handleAddEntry() {
    if (!entryNote.trim()) { alert('Note is required.'); return }
    setSavingEntry(true)
    const res = await fetch('/api/research-project-journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        collection_id: entryTreeId || null,
        entry_date: entryDate,
        note: entryNote.trim(),
        photo_url: entryPhotoUrl.trim() || null,
      }),
    })
    const data = await res.json()
    setSavingEntry(false)
    if (!res.ok) { alert('Error: ' + data.error); return }
    setEntryNote('')
    setEntryPhotoUrl('')
    fetchAll()
  }

  async function handleGenerateReport() {
    setGeneratingReport(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 40
      let y = 40

      let logoDataUrl: string | null = null
      try {
        const res = await fetch('/logo.png')
        const blob = await res.blob()
        logoDataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
      } catch (e) {
        console.warn('Logo failed to load', e)
      }

      function checkPageBreak(needed: number) {
        if (y + needed > doc.internal.pageSize.getHeight() - 40) {
          doc.addPage()
          y = 40
        }
      }

      // Measures each label's actual width rather than assuming a fixed
      // column offset, avoiding the label-overlap bug fixed on the
      // Collection report (long labels colliding with the value column).
      function addKeyValueSection(title: string, fields: [string, any][]) {
        checkPageBreak(30)
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.setFillColor(245, 245, 245)
        doc.rect(margin, y - 12, pageWidth - margin * 2, 18, 'F')
        doc.text(title, margin + 5, y)
        y += 20
        doc.setFontSize(10)

        const shown = fields.filter(([, v]) => v !== null && v !== undefined && v !== '')
        if (shown.length === 0) {
          doc.setFont('helvetica', 'italic')
          doc.setTextColor(150, 150, 150)
          doc.text('Nothing recorded.', margin + 5, y)
          doc.setTextColor(0, 0, 0)
          y += 16
          return
        }

        shown.forEach(([label, value]) => {
          doc.setFont('helvetica', 'bold')
          const labelText = `${label}:`
          const labelWidth = doc.getTextWidth(labelText)
          const valueX = margin + 5 + labelWidth + 6
          const lines = doc.splitTextToSize(String(value), pageWidth - margin - valueX)
          checkPageBreak(13 * lines.length + 4)
          doc.setTextColor(60, 60, 60)
          doc.text(labelText, margin + 5, y)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(20, 20, 20)
          doc.text(lines, valueX, y)
          y += 13 * lines.length
        })
        doc.setTextColor(0, 0, 0)
        y += 8
      }

      function addTreeSection(t: any) {
        checkPageBreak(30)
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.setFillColor(230, 240, 225)
        doc.rect(margin, y - 12, pageWidth - margin * 2, 18, 'F')
        doc.text(t.displayName || 'Unnamed tree', margin + 5, y)
        y += 20

        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(60, 60, 60)
        if (t.speciesLabel) { doc.text(`Species: ${t.speciesLabel}`, margin + 5, y); y += 14 }
        if (t.sourceLabel) { doc.text(`Source: ${t.sourceLabel}`, margin + 5, y); y += 14 }
        doc.setTextColor(0, 0, 0)

        if (t.baseline_date) {
          checkPageBreak(14)
          doc.text(
            `Baseline (${t.baseline_date}): ${t.baseline_caliper_mm ?? '\u2014'}mm caliper, ${t.baseline_height_mm ?? '\u2014'}mm height`,
            margin + 5, y
          )
          y += 14
          if (t.baseline_notes) {
            const lines = doc.splitTextToSize(t.baseline_notes, pageWidth - margin * 2 - 10)
            checkPageBreak(12 * lines.length)
            doc.setFont('helvetica', 'italic')
            doc.setFontSize(9)
            doc.text(lines, margin + 5, y)
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(10)
            y += 12 * lines.length
          }
        } else {
          doc.text('No baseline recorded.', margin + 5, y)
          y += 14
        }

        const treeMeasurements = (measurements[t.id] || []).slice().sort((a: any, b: any) =>
          a.measurement_date < b.measurement_date ? -1 : a.measurement_date > b.measurement_date ? 1 : 0
        )

        if (treeMeasurements.length > 0) {
          y += 4
          checkPageBreak(16)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(9)
          doc.text('Date', margin + 5, y)
          doc.text('Caliper', margin + 145, y)
          doc.text('Height', margin + 210, y)
          doc.text('\u0394 Caliper', margin + 275, y)
          doc.text('\u0394 Height', margin + 345, y)
          doc.text('Notes', margin + 415, y)
          y += 4
          doc.setDrawColor(210)
          doc.line(margin + 5, y, pageWidth - margin, y)
          y += 12
          doc.setFont('helvetica', 'normal')

          const baseCaliper = t.baseline_caliper_mm !== null && t.baseline_caliper_mm !== undefined ? Number(t.baseline_caliper_mm) : null
          const baseHeight = t.baseline_height_mm !== null && t.baseline_height_mm !== undefined ? Number(t.baseline_height_mm) : null

          treeMeasurements.forEach((m: any) => {
            const caliper = m.caliper_mm !== null && m.caliper_mm !== undefined ? Number(m.caliper_mm) : null
            const height = m.height_mm !== null && m.height_mm !== undefined ? Number(m.height_mm) : null
            const deltaCaliper = caliper !== null && baseCaliper !== null ? `+${(caliper - baseCaliper).toFixed(1)}` : '\u2014'
            const deltaHeight = height !== null && baseHeight !== null ? `+${(height - baseHeight).toFixed(1)}` : '\u2014'
            const notesLines = m.notes ? doc.splitTextToSize(m.notes, pageWidth - margin - (margin + 415)) : ['']
            checkPageBreak(12 * Math.max(notesLines.length, 1))
            doc.text(m.measurement_date, margin + 5, y)
            doc.text(caliper !== null ? `${caliper}mm` : '\u2014', margin + 145, y)
            doc.text(height !== null ? `${height}mm` : '\u2014', margin + 210, y)
            doc.text(deltaCaliper !== '\u2014' ? `${deltaCaliper}mm` : '\u2014', margin + 275, y)
            doc.text(deltaHeight !== '\u2014' ? `${deltaHeight}mm` : '\u2014', margin + 345, y)
            if (m.notes) doc.text(notesLines, margin + 415, y)
            y += 12 * Math.max(notesLines.length, 1)
          })
        } else {
          doc.setFont('helvetica', 'italic')
          doc.setFontSize(9)
          doc.setTextColor(150, 150, 150)
          doc.text('No measurements logged since baseline.', margin + 5, y)
          doc.setTextColor(0, 0, 0)
          doc.setFontSize(10)
          y += 14
        }

        const treeJournal = journal.filter((j: any) => j.collection_id === t.collection_id && t.collection_id)
        if (treeJournal.length > 0) {
          y += 6
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(9)
          checkPageBreak(12)
          doc.text('Tree-specific journal entries:', margin + 5, y)
          y += 12
          doc.setFont('helvetica', 'normal')
          treeJournal.forEach((j: any) => {
            const lines = doc.splitTextToSize(`${j.entry_date} \u2014 ${j.note}`, pageWidth - margin * 2 - 10)
            checkPageBreak(12 * lines.length)
            doc.text(lines, margin + 5, y)
            y += 12 * lines.length
          })
        }

        y += 12
      }

      // Header
      if (logoDataUrl) {
        const logoSize = 60
        doc.addImage(logoDataUrl, 'PNG', margin, y, logoSize, logoSize)
        doc.setFontSize(18)
        doc.setFont('helvetica', 'bold')
        doc.text('Bonsai Australis', margin + logoSize + 15, y + 28)
        doc.setFontSize(11)
        doc.setFont('helvetica', 'normal')
        doc.text('Research Project Report', margin + logoSize + 15, y + 46)
        y += logoSize + 25
      } else {
        doc.setFontSize(18)
        doc.setFont('helvetica', 'bold')
        doc.text('Bonsai Australis \u2014 Research Project Report', margin, y + 10)
        y += 35
      }

      doc.setDrawColor(180)
      doc.line(margin, y, pageWidth - margin, y)
      y += 20

      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text(project.title || 'Untitled Project', margin, y)
      y += 18

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(80, 80, 80)
      doc.text(
        `Status: ${project.status || '\u2014'}${project.start_date ? `  \u00b7  Started ${project.start_date}` : ''}${project.end_date ? `  \u00b7  Ended ${project.end_date}` : ''}`,
        margin, y
      )
      doc.setTextColor(0, 0, 0)
      y += 20

      addKeyValueSection('Hypothesis & Methodology', [
        ['Hypothesis', project.hypothesis],
        ['Methodology', project.methodology],
      ])

      // Per-tree results — the actual point of the report.
      checkPageBreak(20)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(`Results \u2014 ${trees.length} tree${trees.length === 1 ? '' : 's'}`, margin, y)
      y += 18

      trees.forEach((t: any) => addTreeSection(t))

      // Pod-wide journal (entries with no specific tree attached).
      const podWideJournal = journal.filter((j: any) => !j.collection_id)
      if (podWideJournal.length > 0) {
        checkPageBreak(30)
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.setFillColor(245, 245, 245)
        doc.rect(margin, y - 12, pageWidth - margin * 2, 18, 'F')
        doc.text('Pod-Wide Journal', margin + 5, y)
        y += 20
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        podWideJournal.forEach((j: any) => {
          const lines = doc.splitTextToSize(`${j.entry_date} \u2014 ${j.note}`, pageWidth - margin * 2 - 10)
          checkPageBreak(13 * lines.length)
          doc.text(lines, margin + 5, y)
          y += 13 * lines.length
        })
      }

      const fileName = (project.title || 'research_project').replace(/[^a-z0-9]+/gi, '_').toLowerCase()
      doc.save(`${fileName}_report.pdf`)
    } catch (e: any) {
      alert('Error generating report: ' + e.message)
    } finally {
      setGeneratingReport(false)
    }
  }

  if (loading) return <main style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}><p style={{ color: '#9ca3af' }}>Loading...</p></main>
  if (error) return <main style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}><p style={{ color: '#dc2626' }}>Error: {error}</p></main>
  if (!project) return null

  const fieldStyle: React.CSSProperties = { width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '8px' }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '2px' }

  return (
    <main style={{ maxWidth: '900px', width: '100%', margin: '0 auto', padding: '16px', boxSizing: 'border-box' }}>
      <a href="/research-projects" style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none' }}>&larr; Research Projects</a>

      {editingHeader ? (
        <div style={{ background: '#f9fafb', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', margin: '8px 0 16px' }}>
          <label style={labelStyle}>Title</label>
          <input type="text" value={headerTitle} onChange={e => setHeaderTitle(e.target.value)} style={fieldStyle} />

          <label style={labelStyle}>Status</label>
          <select value={headerStatus} onChange={e => setHeaderStatus(e.target.value)} style={fieldStyle}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <label style={labelStyle}>Hypothesis</label>
          <textarea value={headerHypothesis} onChange={e => setHeaderHypothesis(e.target.value)} rows={2} style={fieldStyle} />

          <label style={labelStyle}>Methodology</label>
          <textarea value={headerMethodology} onChange={e => setHeaderMethodology(e.target.value)} rows={2} style={fieldStyle} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={labelStyle}>Start Date</label>
              <input type="date" value={headerStartDate} onChange={e => setHeaderStartDate(e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>End Date</label>
              <input type="date" value={headerEndDate} onChange={e => setHeaderEndDate(e.target.value)} style={fieldStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
            <button onClick={() => setEditingHeader(false)} style={{ flex: 1, padding: '8px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', color: '#6b7280', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSaveHeader} disabled={savingHeader} style={{ flex: 1, padding: '8px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
              {savingHeader ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', margin: '4px 0 4px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>{project.title}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', background: (statusColor[project.status] || '#6b7280') + '22', color: statusColor[project.status] || '#6b7280', textTransform: 'capitalize' }}>
                {project.status}
              </span>
              <button onClick={handleGenerateReport} disabled={generatingReport} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                {generatingReport ? 'Generating...' : '\ud83d\udcc4 PDF Report'}
              </button>
              <button onClick={openHeaderEditor} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', cursor: 'pointer', padding: 0 }}>Edit</button>
            </div>
          </div>

          {project.hypothesis && (
            <div style={{ marginBottom: '10px' }}>
              <p style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', margin: '0 0 2px' }}>Hypothesis</p>
              <p style={{ fontSize: '14px', color: '#374151', margin: 0 }}>{project.hypothesis}</p>
            </div>
          )}
          {project.methodology && (
            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', margin: '0 0 2px' }}>Methodology</p>
              <p style={{ fontSize: '14px', color: '#374151', margin: 0 }}>{project.methodology}</p>
            </div>
          )}
          <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '24px' }}>
            {project.start_date ? `Started ${project.start_date}` : ''}{project.end_date ? ` \u00b7 Ended ${project.end_date}` : ''}
          </p>
        </>
      )}

      <h2 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 10px' }}>Trees in this project ({trees.length})</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px', marginBottom: '28px' }}>
        {trees.map(t => (
          <div key={t.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              {t.imageUrl ? (
                <img src={t.imageUrl} alt="" style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
              ) : (
                <div style={{ width: '48px', height: '48px', background: '#f1f5f9', borderRadius: '6px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>&#127807;</div>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                  <p style={{ fontWeight: '600', fontSize: '14px', margin: 0 }}>{t.displayName}</p>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button onClick={() => openTreeEditor(t)} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '11px', cursor: 'pointer', padding: 0 }}>Edit</button>
                    <button onClick={() => handleRemoveTree(t.id, t.displayName)} disabled={removingTreeId === t.id} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '11px', cursor: 'pointer', padding: 0 }}>
                      {removingTreeId === t.id ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                </div>
                {t.speciesLabel && <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>{t.speciesLabel}</p>}
                {t.sourceLabel && <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0' }}>{t.sourceLabel}</p>}
                {t.collection_id && (
                  <a href={`/collection/${t.collection_id}`} style={{ fontSize: '11px', color: '#2563eb', textDecoration: 'none' }}>
                    Fix name/species in Collection &rarr;
                  </a>
                )}
                {t.tubestock_id && (
                  <a href={`/tubestock-admin?id=${t.tubestock_id}`} style={{ fontSize: '11px', color: '#2563eb', textDecoration: 'none' }}>
                    Fix name/species in Tubestock &rarr;
                  </a>
                )}
              </div>
            </div>

            {editingTreeId === t.id && (
              <div style={{ marginTop: '10px', background: '#f9fafb', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Next measurement date</label>
                <input type="date" value={treeNextMeasDate} onChange={e => setTreeNextMeasDate(e.target.value)}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '6px' }} />
                <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Measurement interval (days)</label>
                <input type="number" value={treeMeasIntervalDays} onChange={e => setTreeMeasIntervalDays(e.target.value)}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '8px' }} />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => setEditingTreeId(null)} style={{ flex: 1, padding: '6px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', color: '#6b7280', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={() => handleSaveTreeEdit(t.id)} disabled={savingTreeEdit} style={{ flex: 1, padding: '6px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                    {savingTreeEdit ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}

            {editingBaselineId === t.id ? (
              <div style={{ marginTop: '10px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Caliper (mm)</label>
                <input type="number" value={baselineCaliper} onChange={e => setBaselineCaliper(e.target.value)}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '6px' }} />
                <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Height (mm)</label>
                <input type="number" value={baselineHeight} onChange={e => setBaselineHeight(e.target.value)}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '6px' }} />
                <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Notes</label>
                <textarea value={baselineNotes} onChange={e => setBaselineNotes(e.target.value)} rows={2}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '8px' }} />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => setEditingBaselineId(null)} style={{ flex: 1, padding: '6px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', color: '#6b7280', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={() => handleSaveBaseline(t.id)} disabled={savingBaseline} style={{ flex: 1, padding: '6px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                    {savingBaseline ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : loggingTreeId === t.id ? (
              <div style={{ marginTop: '10px' }}>
                <p style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', margin: '0 0 6px' }}>
                  {editingMeasurementId ? 'Correcting existing entry' : 'Log new measurement'}
                </p>
                <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Date</label>
                <input type="date" value={measDate} onChange={e => setMeasDate(e.target.value)}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '6px' }} />
                <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Caliper (mm)</label>
                <input type="number" value={measCaliper} onChange={e => setMeasCaliper(e.target.value)}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '6px' }} />
                <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Height (mm)</label>
                <input type="number" value={measHeight} onChange={e => setMeasHeight(e.target.value)}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '6px' }} />
                <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Notes</label>
                <textarea value={measNotes} onChange={e => setMeasNotes(e.target.value)} rows={2}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '8px' }} />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => { setLoggingTreeId(null); setEditingMeasurementId(null) }} style={{ flex: 1, padding: '6px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', color: '#6b7280', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={() => handleSaveMeasurement(t.id)} disabled={savingMeasurement} style={{ flex: 1, padding: '6px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                    {savingMeasurement ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#6b7280' }}>
                {t.baseline_date ? (
                  <>
                    <p style={{ margin: '0 0 2px' }}>Baseline ({t.baseline_date}): {t.baseline_caliper_mm ?? '\u2014'}mm caliper, {t.baseline_height_mm ?? '\u2014'}mm height</p>
                    {t.baseline_notes && <p style={{ margin: '0 0 6px', fontStyle: 'italic' }}>{t.baseline_notes}</p>}
                  </>
                ) : (
                  <p style={{ margin: '0 0 6px' }}>No baseline recorded yet.</p>
                )}

                {(measurements[t.id] || []).length > 0 && (
                  <div style={{ margin: '4px 0 6px', paddingLeft: '2px', borderLeft: '2px solid #f1f5f9' }}>
                    {(measurements[t.id] || []).map((m: any) => (
                      <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px', paddingLeft: '8px', marginBottom: '2px' }}>
                        <p style={{ margin: 0 }}>
                          {m.measurement_date}: {m.caliper_mm ?? '\u2014'}mm caliper, {m.height_mm ?? '\u2014'}mm height
                          {m.notes ? ` \u2014 ${m.notes}` : ''}
                        </p>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <button onClick={() => openMeasurementEditor(t.id, m)} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '11px', cursor: 'pointer', padding: 0 }}>Edit</button>
                          <button onClick={() => handleDeleteMeasurement(m.id)} disabled={deletingMeasurementId === m.id} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '11px', cursor: 'pointer', padding: 0 }}>
                            {deletingMeasurementId === m.id ? '...' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  {!t.baseline_date && (
                    <button onClick={() => openBaselineEditor(t)} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', cursor: 'pointer', padding: 0 }}>
                      Record baseline
                    </button>
                  )}
                  {t.baseline_date && (
                    <button onClick={() => openMeasurementLogger(t.id)} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', cursor: 'pointer', padding: 0 }}>
                      Log measurement
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {trees.length === 0 && <p style={{ color: '#9ca3af', fontSize: '13px' }}>No trees linked to this project.</p>}
      </div>

      <h2 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 10px' }}>Journal</h2>

      <div style={{ background: '#f9fafb', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Date</label>
        <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)}
          style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '8px' }} />

        <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Tree</label>
        <select value={entryTreeId} onChange={e => setEntryTreeId(e.target.value)}
          style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', marginBottom: '8px' }}>
          <option value="">Pod-wide note</option>
          {trees.map(t => <option key={t.collection_id} value={t.collection_id}>{t.displayName}</option>)}
        </select>

        <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Note</label>
        <textarea value={entryNote} onChange={e => setEntryNote(e.target.value)} rows={3}
          style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '8px' }} />

        <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Photo URL (optional)</label>
        <input type="text" value={entryPhotoUrl} onChange={e => setEntryPhotoUrl(e.target.value)}
          style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '10px' }} />

        <button onClick={handleAddEntry} disabled={savingEntry}
          style={{ width: '100%', padding: '10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
          {savingEntry ? 'Saving...' : 'Add Journal Entry'}
        </button>
      </div>

      <div>
        {journal.map(j => (
          <div key={j.id} style={{ borderBottom: '1px solid #f1f5f9', padding: '10px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>{j.entry_date}</span>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>{j.treeName || 'Pod-wide'}</span>
            </div>
            <p style={{ fontSize: '14px', color: '#374151', margin: '4px 0 0' }}>{j.note}</p>
            {j.photo_url && <img src={j.photo_url} alt="" style={{ marginTop: '6px', maxWidth: '100%', borderRadius: '8px' }} />}
          </div>
        ))}
        {journal.length === 0 && <p style={{ color: '#9ca3af', fontSize: '13px' }}>No journal entries yet.</p>}
      </div>
    </main>
  )
}
