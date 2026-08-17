'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import jsPDF from 'jspdf'

// ---- Zone reference data (matches the species-page Placement Matrix definitions) ----
const ZONES = [
  { letter: 'A', label: 'Full sun',            hint: '8-10hrs — hot westerlies, turbulent gusts',                    color: '#c0392b' },
  { letter: 'B', label: 'Morning sun',          hint: '4-6hrs — gentle airflow, occasional gusts',                    color: '#d9a02b' },
  { letter: 'C', label: 'Dappled shade',        hint: '2-4hrs — soft airflow, sheltered',                             color: '#7a9c42' },
  { letter: 'D', label: 'Full sun, windy',      hint: '6-8hrs — consistent strong airflow, wind tunnel',              color: '#8e44ad' },
  { letter: 'E', label: 'Variable, cold drainage', hint: '3-5hrs — cold air drainage, stagnant air (frost pocket)',  color: '#2e6da8' },
  { letter: 'F', label: 'Variable, sheltered',  hint: '2-6hrs — sheltered, minimal airflow',                          color: '#0d9488' },
  { letter: 'G', label: 'Full shade',           hint: '0-2hrs — still air, high humidity, deep shade',                color: '#2E2510' },
] as const

type ZoneLetter = typeof ZONES[number]['letter']

function zoneColor(letter: string) {
  return ZONES.find(z => z.letter === letter)?.color || '#2b2620'
}

// ---- Annotation types ----
type Pin = { type: 'pin'; x: number; y: number; letter: ZoneLetter }
type Path = { type: 'path'; letter: ZoneLetter; points: { x: number; y: number }[] }
type TextNote = { type: 'text'; x: number; y: number; letter: ZoneLetter; text: string }
type Annotation = Pin | Path | TextNote

// ---- Placement matrix reference row (live from DB) ----
type PMRow = {
  sp_no: number
  species: string
  common_name: string | null
  exposure_full_sun: string | null
  exposure_morning_sun: string | null
  exposure_dappled_shade: string | null
  exposure_full_sun_windy: string | null
  exposure_variable_e: string | null
  exposure_variable_f: string | null
  exposure_full_shade: string | null
}

export default function PlacementPlotterPage() {
  const [pmRows, setPmRows] = useState<PMRow[]>([])
  const [pmLoading, setPmLoading] = useState(true)

  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [dragOver, setDragOver] = useState(false)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [activeZone, setActiveZone] = useState<ZoneLetter>('A')
  const [tool, setTool] = useState<'pin' | 'draw' | 'text' | 'erase'>('pin')
  const [siteName, setSiteName] = useState('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef<{ active: boolean; points: { x: number; y: number }[] }>({ active: false, points: [] })
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ;(async () => {
      const { data, error } = await supabase
        .from('placement_matrix')
        .select('sp_no, species, exposure_full_sun, exposure_morning_sun, exposure_dappled_shade, exposure_full_sun_windy, exposure_variable_e, exposure_variable_f, exposure_full_shade')
        .order('species')
      if (!error && data) {
        const rows = data as PMRow[]
        const spNos = rows.map(d => d.sp_no)
        const { data: speciesRows } = await supabase.from('species').select('sp_no, common_name').in('sp_no', spNos)
        const commonMap = new Map((speciesRows || []).map((s: { sp_no: number; common_name: string | null }) => [s.sp_no, s.common_name]))
        setPmRows(rows.map(d => ({ ...d, common_name: commonMap.get(d.sp_no) || null })))
      }
      setPmLoading(false)
    })()
  }, [])

  const drawAll = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (image) ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    else {
      ctx.fillStyle = '#fffefb'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = '#e2dac2'
      ctx.lineWidth = 2
      ctx.setLineDash([8, 6])
      ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8)
      ctx.setLineDash([])
      ctx.fillStyle = '#a39a7c'
      ctx.font = '16px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Drop or choose a site plan image above to begin', canvas.width / 2, canvas.height / 2)
    }

    for (const a of annotations) {
      if (a.type === 'pin') {
        ctx.beginPath()
        ctx.arc(a.x, a.y, 16, 0, Math.PI * 2)
        ctx.fillStyle = zoneColor(a.letter)
        ctx.globalAlpha = 0.85
        ctx.fill()
        ctx.globalAlpha = 1
        ctx.strokeStyle = 'white'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.fillStyle = 'white'
        ctx.font = 'bold 15px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(a.letter, a.x, a.y + 1)
      } else if (a.type === 'path') {
        if (a.points.length < 2) continue
        ctx.beginPath()
        ctx.moveTo(a.points[0].x, a.points[0].y)
        for (const p of a.points.slice(1)) ctx.lineTo(p.x, p.y)
        ctx.strokeStyle = zoneColor(a.letter)
        ctx.lineWidth = 4
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.globalAlpha = 0.9
        ctx.stroke()
        ctx.globalAlpha = 1
      } else if (a.type === 'text') {
        ctx.fillStyle = 'white'
        ctx.font = 'bold 13px sans-serif'
        const w = ctx.measureText(a.text).width
        ctx.fillRect(a.x - 4, a.y - 14, w + 8, 18)
        ctx.fillStyle = zoneColor(a.letter)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
        ctx.fillText(a.text, a.x, a.y)
      }
    }
  }, [image, annotations])

  useEffect(() => { drawAll() }, [drawAll])

  function loadImageFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        setImage(img)
        setAnnotations([])
        setFileName(file.name)
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) loadImageFile(file)
  }

  function getCanvasPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  function handleCanvasMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!image) return
    const pos = getCanvasPos(e)
    if (tool === 'pin') {
      setAnnotations(prev => [...prev, { type: 'pin', x: pos.x, y: pos.y, letter: activeZone }])
    } else if (tool === 'text') {
      const text = window.prompt('Label text:')
      if (text) setAnnotations(prev => [...prev, { type: 'text', x: pos.x, y: pos.y, letter: activeZone, text }])
    } else if (tool === 'draw') {
      drawingRef.current = { active: true, points: [pos] }
    } else if (tool === 'erase') {
      // remove nearest annotation within a click radius
      setAnnotations(prev => {
        let closestIdx = -1
        let closestDist = 28
        prev.forEach((a, i) => {
          const pts = a.type === 'path' ? a.points : [a]
          for (const p of pts) {
            const d = Math.hypot(p.x - pos.x, p.y - pos.y)
            if (d < closestDist) { closestDist = d; closestIdx = i }
          }
        })
        if (closestIdx === -1) return prev
        return prev.filter((_, i) => i !== closestIdx)
      })
    }
  }

  function handleCanvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (tool !== 'draw' || !drawingRef.current.active) return
    const pos = getCanvasPos(e)
    drawingRef.current.points.push(pos)
    // live-render the in-progress stroke without committing to state every move
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        drawAll()
        const pts = drawingRef.current.points
        if (pts.length > 1) {
          ctx.beginPath()
          ctx.moveTo(pts[0].x, pts[0].y)
          for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y)
          ctx.strokeStyle = zoneColor(activeZone)
          ctx.lineWidth = 4
          ctx.lineJoin = 'round'
          ctx.lineCap = 'round'
          ctx.stroke()
        }
      }
    }
  }

  function handleCanvasMouseUp() {
    if (tool === 'draw' && drawingRef.current.active) {
      const pts = drawingRef.current.points
      if (pts.length > 1) setAnnotations(prev => [...prev, { type: 'path', letter: activeZone, points: pts }])
      drawingRef.current = { active: false, points: [] }
    }
  }

  function downloadPNG() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `${(siteName || 'site-plan').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_placement_plan.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  function downloadPDF() {
    const canvas = canvasRef.current
    if (!canvas) return
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const margin = 30

    pdf.setFontSize(16)
    pdf.setFont('helvetica', 'bold')
    pdf.text(siteName || 'Site Placement Plan', margin, margin + 4)
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(100, 100, 100)
    pdf.text(new Date().toLocaleDateString(), pageW - margin, margin + 4, { align: 'right' })

    const availW = pageW - margin * 2
    const availH = pageH - margin * 2 - 40
    const ratio = Math.min(availW / canvas.width, availH / canvas.height)
    const drawW = canvas.width * ratio
    const drawH = canvas.height * ratio
    pdf.addImage(imgData, 'PNG', margin, margin + 24, drawW, drawH)

    // Zone legend on the same page, below the image if it fits, otherwise a new page
    let legendY = margin + 24 + drawH + 20
    if (legendY + ZONES.length * 13 > pageH - margin) {
      pdf.addPage()
      legendY = margin
    }
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(0, 0, 0)
    pdf.text('Zone key', margin, legendY)
    legendY += 14
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8.5)
    for (const z of ZONES) {
      const rgb = hexToRgb(z.color)
      pdf.setFillColor(rgb.r, rgb.g, rgb.b)
      pdf.circle(margin + 5, legendY - 3, 4, 'F')
      pdf.setTextColor(0, 0, 0)
      pdf.text(`${z.letter}: ${z.label} — ${z.hint}`, margin + 14, legendY)
      legendY += 13
    }

    pdf.save(`${(siteName || 'site-plan').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_placement_plan.pdf`)
  }

  function hexToRgb(hex: string) {
    const n = parseInt(hex.replace('#', ''), 16)
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
  }

  const canvasW = image ? Math.min(image.width, 1000) : 800
  const canvasH = image ? canvasW * (image.height / image.width) : 500

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '8px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#2b2620' }}>Placement Matrix Plotter</h1>
        <Link href="/" style={{ fontSize: '13px', background: '#f3f4f6', color: '#374151', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none' }}>
          ← Back to dashboard
        </Link>
      </div>

      {/* ---- Reference: the 7 zones ---- */}
      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#2b2620', marginBottom: '10px' }}>Zone reference</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
          {ZONES.map(z => (
            <div key={z.letter} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', border: '1.5px solid #e2dac2', borderRadius: '8px', padding: '10px 12px', background: '#fffefb' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: z.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>
                {z.letter}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13.5px', color: '#2b2620' }}>{z.label}</div>
                <div style={{ fontSize: '12px', color: '#8a7f5f' }}>{z.hint}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Site plan plotter ---- */}
      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#2b2620', marginBottom: '10px' }}>Mark up your site plan</h2>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Site / property name (used as file name and PDF title)"
            value={siteName}
            onChange={e => setSiteName(e.target.value)}
            style={{ flex: '1 1 260px', padding: '8px 12px', border: '1.5px solid #e2dac2', borderRadius: '8px', fontSize: '14px' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ fontSize: '13px', background: '#7a9c42', color: 'white', padding: '8px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            {image ? 'Replace image' : 'Choose site plan image'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) loadImageFile(f) }}
          />
          {fileName && <span style={{ fontSize: '12.5px', color: '#8a7f5f' }}>{fileName}</span>}
        </div>

        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            border: dragOver ? '2px dashed #7a9c42' : '2px dashed transparent',
            borderRadius: '10px',
            padding: dragOver ? '4px' : '0',
            transition: 'border-color 0.15s',
          }}
        >
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px', background: '#fbf7ec', border: '1.5px solid #e2dac2', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#8a7f5f', marginRight: '4px' }}>ZONE</span>
              {ZONES.map(z => (
                <button
                  key={z.letter}
                  onClick={() => setActiveZone(z.letter)}
                  title={`${z.label} (${z.hint})`}
                  style={{
                    width: '28px', height: '28px', borderRadius: '50%', border: activeZone === z.letter ? '3px solid #2b2620' : '2px solid white',
                    background: z.color, color: 'white', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
                    boxShadow: activeZone === z.letter ? '0 0 0 2px ' + z.color + '55' : 'none',
                  }}
                >
                  {z.letter}
                </button>
              ))}
            </div>
            <div style={{ width: '1px', height: '24px', background: '#e2dac2' }} />
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['pin', 'draw', 'text', 'erase'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTool(t)}
                  style={{
                    fontSize: '13px', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer',
                    border: tool === t ? '1.5px solid #2b2620' : '1.5px solid #e2dac2',
                    background: tool === t ? '#2b2620' : 'white',
                    color: tool === t ? 'white' : '#2b2620',
                    fontWeight: tool === t ? 600 : 400,
                    textTransform: 'capitalize',
                  }}
                >
                  {t === 'pin' ? '📍 Pin' : t === 'draw' ? '✏️ Draw boundary' : t === 'text' ? '🔤 Label' : '🗑 Erase'}
                </button>
              ))}
            </div>
            <div style={{ width: '1px', height: '24px', background: '#e2dac2' }} />
            <button
              onClick={() => setAnnotations([])}
              style={{ fontSize: '13px', padding: '6px 12px', borderRadius: '6px', border: '1.5px solid #e2dac2', background: 'white', color: '#8a7f5f', cursor: 'pointer' }}
            >
              Clear all marks
            </button>
          </div>

          <canvas
            ref={canvasRef}
            width={canvasW}
            height={canvasH}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            style={{ width: '100%', maxWidth: `${canvasW}px`, height: 'auto', border: '1.5px solid #e2dac2', borderRadius: '10px', cursor: image ? 'crosshair' : 'default', display: 'block' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={downloadPDF}
            disabled={!image}
            style={{ fontSize: '13px', background: image ? '#2b2620' : '#d4cdb3', color: 'white', padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: image ? 'pointer' : 'not-allowed', fontWeight: 600 }}
          >
            📄 Download / print as PDF
          </button>
          <button
            onClick={downloadPNG}
            disabled={!image}
            style={{ fontSize: '13px', background: 'white', color: image ? '#2b2620' : '#d4cdb3', padding: '8px 16px', borderRadius: '6px', border: '1.5px solid #e2dac2', cursor: image ? 'pointer' : 'not-allowed' }}
          >
            Download as image (PNG)
          </button>
        </div>
      </section>

      {/* ---- Full placement matrix reference table ---- */}
      <section>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#2b2620', marginBottom: '10px' }}>
          Researched species placement data {pmLoading ? '' : `(${pmRows.length})`}
        </h2>
        {pmLoading ? (
          <p style={{ color: '#8a7f5f', fontSize: '13px' }}>Loading…</p>
        ) : pmRows.length === 0 ? (
          <p style={{ color: '#8a7f5f', fontSize: '13px' }}>No placement_matrix rows populated yet.</p>
        ) : (
          <div style={{ overflowX: 'auto', border: '1.5px solid #e2dac2', borderRadius: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ background: '#2b2620', color: 'white' }}>
                  <th style={thStyle}>Species</th>
                  <th style={thStyle}>A</th>
                  <th style={thStyle}>B</th>
                  <th style={thStyle}>C</th>
                  <th style={thStyle}>D</th>
                  <th style={thStyle}>E</th>
                  <th style={thStyle}>F</th>
                  <th style={thStyle}>G</th>
                </tr>
              </thead>
              <tbody>
                {pmRows.map((r, i) => (
                  <tr key={r.sp_no} style={{ background: i % 2 ? '#FBF7EC' : 'white' }}>
                    <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600 }}>
                      {r.species}
                      {r.common_name && <div style={{ fontWeight: 400, fontSize: '11px', color: '#8a7f5f' }}>{r.common_name}</div>}
                    </td>
                    <td style={tdStyle}>{r.exposure_full_sun || '—'}</td>
                    <td style={tdStyle}>{r.exposure_morning_sun || '—'}</td>
                    <td style={tdStyle}>{r.exposure_dappled_shade || '—'}</td>
                    <td style={tdStyle}>{r.exposure_full_sun_windy || '—'}</td>
                    <td style={tdStyle}>{r.exposure_variable_e || '—'}</td>
                    <td style={tdStyle}>{r.exposure_variable_f || '—'}</td>
                    <td style={tdStyle}>{r.exposure_full_shade || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

const thStyle: React.CSSProperties = { padding: '8px 10px', textAlign: 'center', fontWeight: 700, fontSize: '12px', whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '7px 10px', textAlign: 'center', borderTop: '1px solid #e2dac2' }
