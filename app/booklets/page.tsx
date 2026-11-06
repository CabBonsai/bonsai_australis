'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { INTERNAL_WORDING, PRINT_BLOCK, PRINT_ROWS, isPrintable } from '@/lib/advancedReport';

type SpeciesResult = { sp_no: number; species: string; species_genus: string; common_name: string | null };
type BookletListItem = {
  id: string;
  sp_no: number;
  species_name: string;
  common_name: string | null;
  title: string | null;
  status: string;
  price: number | null;
  version: number;
  updated_at: string;
  published_at: string | null;
};
type Booklet = {
  id: string;
  sp_no: number;
  title: string | null;
  status: string;
  price: number | null;
  version: number;
  content: string | null;
  pdf_url: string | null;
};
type ReportRow = { label: string; value: string | null };
type ReportSectionData = { id: string; title: string; rows: ReportRow[] };
type Report = { species: { sp_no: number; name: string; common_name: string | null }; sections: ReportSectionData[] };
type ReferenceCategory = { id: string; label: string; sections: { table: string; data: Record<string, unknown> | null }[] };

const STATUS_COLORS: Record<string, string> = {
  draft: '#9ca3af',
  in_review: '#D9A02B',
  ready: '#55702A',
  published: '#2E2510',
};

// Lightweight markdown -> HTML for preview/print. Handles the subset actually used in booklets:
// #/## headers, **bold**, *italic*, --- as a section divider, blank-line-separated paragraphs.
// Deliberately not pulling in a markdown library dependency for this - the format is simple and
// controlled (we write the content ourselves), so a small hand-rolled renderer is enough and
// avoids an extra npm install.
function renderMarkdown(md: string): string {
  const lines = md.split('\n');
  const html: string[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      const text = paragraph.join(' ');
      html.push(`<p>${inlineFormat(text)}</p>`);
      paragraph = [];
    }
  };

  const inlineFormat = (text: string) =>
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '') {
      flushParagraph();
      continue;
    }
    if (line === '---') {
      flushParagraph();
      html.push('<hr />');
      continue;
    }
    if (line.startsWith('## ')) {
      flushParagraph();
      html.push(`<h2>${inlineFormat(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('# ')) {
      flushParagraph();
      html.push(`<h1>${inlineFormat(line.slice(2))}</h1>`);
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  return html.join('\n');
}

// Part One: eyebrow, title, Latin name, gold rule, then the chapter text. If the chapter text
// starts with its own "# Title" line, that becomes the title (so existing booklets keep working);
// otherwise the booklet's title field is used.
function ChapterBody({ content, fallbackTitle, latinName }: { content: string; fallbackTitle: string; latinName: string }) {
  const lines = content.split('\n');
  const first = lines.findIndex((l) => l.trim() !== '');
  let title = fallbackTitle;
  let body = content;
  if (first !== -1 && lines[first].trim().startsWith('# ')) {
    title = lines[first].trim().slice(2);
    body = lines.slice(first + 1).join('\n');
  }
  return (
    <>
      <header className="chapter-header">
        <div className="chapter-eyebrow">BONSAI AUSTRALIS</div>
        <h1 className="chapter-title">{title}</h1>
        {latinName && <div className="chapter-latin">{latinName}</div>}
        <div className="chapter-rule" />
      </header>
      <div className="chapter-text" dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />
    </>
  );
}

// Cover and closing pages. The artwork is a fixed image (public/booklet) with the chapter line left
// blank; the line is real text laid over it, so every booklet gets its own species name without a
// new picture. The closing page is one fixed image. Sizes use container units so the lettering
// scales with the page on screen and in print.
function BookletCover({ line }: { line: string }) {
  const text = `Chapter: ${line}`;
  // 4.35cqw fits a 31-character line; longer names shrink to stay inside the gold rule.
  const size = Math.min(4.35, (4.35 * 31) / Math.max(text.length, 1));
  return (
    <div className="booklet-page booklet-cover" role="img" aria-label={`Cover: ${text}`}>
      <div className="booklet-cover-line" style={{ fontSize: `${size}cqw` }}>{text}</div>
    </div>
  );
}

function BookletClosing() {
  return <div className="booklet-page booklet-closing" role="img" aria-label="Closing page" />;
}

// Part Two: "Advanced Species Report" - built from the database, never typed by hand. Rows whose
// text still contains project-internal wording are marked (screen only, never printed) so they can
// be reworded in the database before the chapter is published.
function AdvancedReport({ report }: { report: Report }) {
  return (
    <section className="report">
      <header className="chapter-header report-start">
        <div className="chapter-eyebrow">PART TWO</div>
        <h1 className="chapter-title">Advanced Species Report</h1>
        <div className="chapter-latin">
          {report.species.name}<span className="no-print"> &middot; sp_no {report.species.sp_no}</span>
        </div>
        <p className="report-disclaimer">
          This information is provided for discussion and research purposes only and does not constitute professional
          horticultural, arboricultural, or bonsai advice. Always verify against multiple sources before acting.
        </p>
      </header>
      {report.sections.map((sec) => {
        const anyPrint = sec.rows.some((r) => isPrintable(sec.id, r.label, r.value));
        return (
          <div key={sec.id} className={`report-section${anyPrint ? '' : ' no-print'}`}>
            <h2 className="report-band">{sec.title}</h2>
            {sec.rows.map((row) => {
              const printable = isPrintable(sec.id, row.label, row.value);
              const held = !!row.value && PRINT_ROWS[sec.id] !== undefined && !printable &&
                (PRINT_ROWS[sec.id] === 'all' || (PRINT_ROWS[sec.id] as string[]).includes(row.label));
              const flagged = row.value ? INTERNAL_WORDING.test(row.value) || PRINT_BLOCK.test(row.value) : false;
              return (
                <div key={row.label} className={`report-row${(row.value?.length ?? 0) < 450 ? ' short' : ''}${printable ? '' : ' no-print not-printed'}`}>
                  <div className="report-label">{row.label}</div>
                  <div className="report-value">
                    {row.value}
                    {!printable && (
                      <span className="no-print internal-flag" title="Rows with internal wording are held back from print until reworded in the database">
                        {held || flagged ? ' held back: internal wording' : ' not printed'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}

export default function BookletsPage() {
  const [view, setView] = useState<'dashboard' | 'editor'>('dashboard');
  const [booklets, setBooklets] = useState<BookletListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Species picker (for starting a new booklet from the dashboard)
  const [query, setQuery] = useState('');
  const [speciesResults, setSpeciesResults] = useState<SpeciesResult[]>([]);

  // Editor state
  const [activeSpNo, setActiveSpNo] = useState<number | null>(null);
  const [booklet, setBooklet] = useState<Booklet | null>(null);
  const [editorMode, setEditorMode] = useState<'write' | 'preview'>('write');
  const [reference, setReference] = useState<{ species: SpeciesResult; categories: ReferenceCategory[] } | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [includeReport, setIncludeReport] = useState(true);
  const [includeCovers, setIncludeCovers] = useState(true);
  // Set when the server-side PDF renderer opens /booklets?print=<sp_no>: load that booklet's
  // preview, skip autosave, and flag when everything has loaded so the renderer knows to print.
  const [printMode, setPrintMode] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const loadList = useCallback(() => {
    setLoadingList(true);
    fetch('/api/booklets?mode=list')
      .then((r) => r.json())
      .then((d) => setBooklets(d.booklets ?? []))
      .finally(() => setLoadingList(false));
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const sp = Number(q.get('print'));
    if (Number.isInteger(sp) && sp > 0) {
      setPrintMode(true);
      setEditorMode('preview');
      setIncludeCovers(q.get('covers') !== '0');
      setIncludeReport(q.get('report') !== '0');
      openBooklet(sp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSpeciesResults([]);
      return;
    }
    const handle = setTimeout(() => {
      fetch(`/api/research-search?mode=species&q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => setSpeciesResults(d.results ?? []));
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const openBooklet = useCallback((spNo: number) => {
    setActiveSpNo(spNo);
    setView('editor');
    setBooklet(null);
    setReference(null);
    setReport(null);
    setReportDone(false);
    setQuery('');
    setSpeciesResults([]);

    fetch(`/api/booklets?mode=get&sp_no=${spNo}`)
      .then((r) => r.json())
      .then((d) => setBooklet(d.booklet));

    fetch(`/api/booklets?mode=reference&sp_no=${spNo}`)
      .then((r) => r.json())
      .then((d) => setReference(d));

    fetch(`/api/booklets?mode=report&sp_no=${spNo}`)
      .then((r) => r.json())
      .then((d) => setReport(d.sections ? d : null))
      .catch(() => setReport(null))
      .finally(() => setReportDone(true));
  }, []);

  const saveBooklet = useCallback(
    (fields: Partial<Booklet>) => {
      if (!booklet) return;
      setSaving(true);
      fetch('/api/booklets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: booklet.id, ...fields }),
      })
        .then((r) => r.json())
        .then((d) => {
          setBooklet(d.booklet);
          setSavedAt(new Date().toLocaleTimeString());
        })
        .finally(() => setSaving(false));
    },
    [booklet]
  );

  // Debounced autosave for the content textarea
  useEffect(() => {
    if (!booklet || printMode) return;
    const handle = setTimeout(() => {
      saveBooklet({ content: booklet.content });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 1500);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booklet?.content]);

  // Set the actual page title to the booklet's own title while it's open - browsers use
  // document.title for both the tab and the print header, so without this every printed
  // booklet said "Bonsai Australis Admin" (or worse, the old unfixed "Create Next App")
  // instead of the booklet's real name. Resets on the way back to the dashboard.
  useEffect(() => {
    if (view === 'editor' && booklet?.title) {
      document.title = booklet.title;
    } else {
      document.title = 'Booklet Studio - Bonsai Australis Admin';
    }
    return () => {
      document.title = 'Bonsai Australis Admin';
    };
  }, [view, booklet?.title]);

  const printBooklet = useCallback(() => {
    // Switch to preview first if needed, then print on the next tick so the rendered
    // HTML is actually in the DOM before the browser's print dialog captures it.
    setEditorMode('preview');
    setTimeout(() => window.print(), 50);
  }, []);

  return (
    <div className="booklet-shell" style={{ maxWidth: view === 'editor' ? '1400px' : '900px', margin: '0 auto', padding: '16px' }}>
      <div style={{ marginBottom: '4px' }} className="no-print">
        {view === 'editor' ? (
          <button
            onClick={() => setView('dashboard')}
            style={{ fontSize: '13px', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            &larr; Booklet Studio
          </button>
        ) : (
          <Link href="/" style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none' }}>
            &larr; Dashboard
          </Link>
        )}
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '4px 0 0' }}>
          {view === 'dashboard' ? 'Booklet Studio' : booklet?.title ?? reference?.species.species ?? 'Loading...'}
        </h1>
      </div>

      {view === 'dashboard' && (
        <>
          {/* Species search to start a new booklet */}
          <div style={{ marginTop: '16px', marginBottom: '24px', position: 'relative' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '13px' }}>
              Start or open a booklet
            </label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search species..."
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
            />
            {speciesResults.length > 0 && (
              <ul
                style={{
                  position: 'absolute', zIndex: 10, background: '#fff', border: '1px solid #ccc', width: '100%',
                  maxHeight: 240, overflowY: 'auto', listStyle: 'none', margin: 0, padding: 0,
                }}
              >
                {speciesResults.map((s) => (
                  <li
                    key={s.sp_no}
                    onClick={() => openBooklet(s.sp_no)}
                    style={{ padding: '0.5rem', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                  >
                    <strong>{s.species}</strong>
                    {s.common_name ? ` — ${s.common_name}` : ''} <span style={{ color: '#888' }}>({s.species_genus})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Status dashboard */}
          <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: 8 }}>All booklets</h2>
          {loadingList && <p style={{ color: '#888' }}>Loading...</p>}
          {!loadingList && booklets.length === 0 && <p style={{ color: '#888' }}>No booklets started yet - search above to begin one.</p>}
          {booklets.map((b) => (
            <div
              key={b.id}
              onClick={() => openBooklet(b.sp_no)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px',
                border: '1px solid #eee', borderRadius: 4, marginBottom: 6, cursor: 'pointer',
              }}
            >
              <div>
                <strong>{b.species_name}</strong>
                {b.common_name ? ` — ${b.common_name}` : ''}
                <span style={{ color: '#888', fontSize: '12px', marginLeft: 8 }}>v{b.version}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {b.price != null && <span style={{ fontSize: '13px', color: '#555' }}>${b.price.toFixed(2)}</span>}
                <span
                  style={{
                    fontSize: '11px', color: '#fff', background: STATUS_COLORS[b.status] ?? '#9ca3af',
                    padding: '3px 8px', borderRadius: 10, textTransform: 'uppercase',
                  }}
                >
                  {b.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))}
        </>
      )}

      {view === 'editor' && (
        <div className="editor-flex-container" style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
          {/* Left: reference panel - read-only pull of all 13 categories */}
          <div className="no-print" style={{ flex: '0 0 40%', maxHeight: '80vh', overflowY: 'auto', border: '1px solid #eee', borderRadius: 4, padding: '12px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#888', marginBottom: 8, textTransform: 'uppercase' }}>
              Reference data (read-only)
            </h3>
            {!reference && <p style={{ color: '#888' }}>Loading reference data...</p>}
            {reference?.categories.map((cat) => {
              const hasContent = cat.sections.some((s) => s.data && Object.values(s.data).some((v) => v !== null && v !== ''));
              if (!hasContent) return null;
              return (
                <details key={cat.id} style={{ marginBottom: 8 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '13px', padding: '4px 0' }}>{cat.label}</summary>
                  {cat.sections.map((section, i) => (
                    <div key={i} style={{ marginLeft: 8, marginBottom: 8 }}>
                      {section.data &&
                        Object.entries(section.data)
                          .filter(([k, v]) => k !== 'sp_no' && v !== null && v !== '')
                          .map(([k, v]) => (
                            <div key={k} style={{ marginBottom: 6, fontSize: '12px' }}>
                              <div style={{ color: '#888', fontWeight: 600 }}>{k}</div>
                              <div style={{ whiteSpace: 'pre-wrap' }}>{String(v)}</div>
                            </div>
                          ))}
                    </div>
                  ))}
                </details>
              );
            })}
          </div>

          {/* Right: editor */}
          <div className="editor-column" style={{ flex: '1 1 60%' }}>
            <div className="no-print" style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                value={booklet?.title ?? ''}
                onChange={(e) => setBooklet((b) => (b ? { ...b, title: e.target.value } : b))}
                onBlur={() => saveBooklet({ title: booklet?.title })}
                placeholder="Booklet title"
                style={{ padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, flex: '1 1 200px' }}
              />
              <select
                value={booklet?.status ?? 'draft'}
                onChange={(e) => saveBooklet({ status: e.target.value })}
                style={{ padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4 }}
              >
                <option value="draft">Draft</option>
                <option value="in_review">In Review</option>
                <option value="ready">Ready</option>
                <option value="published">Published</option>
              </select>
              <input
                type="number"
                step="0.01"
                value={booklet?.price ?? ''}
                onChange={(e) => setBooklet((b) => (b ? { ...b, price: e.target.value ? Number(e.target.value) : null } : b))}
                onBlur={() => saveBooklet({ price: booklet?.price })}
                placeholder="Price $"
                style={{ padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, width: '90px' }}
              />
              <div style={{ display: 'flex', border: '1px solid #ccc', borderRadius: 4, overflow: 'hidden' }}>
                <button
                  onClick={() => setEditorMode('write')}
                  style={{
                    padding: '6px 12px', border: 'none', cursor: 'pointer',
                    background: editorMode === 'write' ? '#2E2510' : '#fff',
                    color: editorMode === 'write' ? '#FBF7EC' : '#333',
                  }}
                >
                  Write
                </button>
                <button
                  onClick={() => setEditorMode('preview')}
                  style={{
                    padding: '6px 12px', border: 'none', cursor: 'pointer',
                    background: editorMode === 'preview' ? '#2E2510' : '#fff',
                    color: editorMode === 'preview' ? '#FBF7EC' : '#333',
                  }}
                >
                  Preview
                </button>
              </div>
              <label style={{ fontSize: '12px', color: '#555', display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="checkbox" checked={includeReport} onChange={(e) => setIncludeReport(e.target.checked)} />
                Include Advanced Species Report
              </label>
              <label style={{ fontSize: '12px', color: '#555', display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="checkbox" checked={includeCovers} onChange={(e) => setIncludeCovers(e.target.checked)} />
                Cover &amp; closing pages
              </label>
              <a
                href={`/api/booklets/pdf?sp_no=${activeSpNo ?? ''}&covers=${includeCovers ? 1 : 0}&report=${includeReport ? 1 : 0}`}
                style={{ padding: '6px 14px', background: '#2E2510', color: '#FBF7EC', border: 'none', borderRadius: 4, textDecoration: 'none', fontSize: '13.33px' }}
              >
                Download PDF
              </a>
              <button
                onClick={printBooklet}
                style={{ padding: '6px 14px', background: '#55702A', color: '#FBF7EC', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Print / Save PDF
              </button>
              <span style={{ fontSize: '12px', color: '#888' }}>
                {saving ? 'Saving...' : savedAt ? `Saved ${savedAt}` : ''}
              </span>
            </div>

            {editorMode === 'write' && (
              <textarea
                value={booklet?.content ?? ''}
                onChange={(e) => setBooklet((b) => (b ? { ...b, content: e.target.value } : b))}
                placeholder="Write the booklet here (Markdown supported: # and ## headers, **bold**, *italic*, --- for a divider)..."
                style={{
                  width: '100%', minHeight: '70vh', padding: '16px', border: '1px solid #ccc', borderRadius: 4,
                  fontFamily: 'Georgia, serif', fontSize: '15px', lineHeight: 1.6, resize: 'vertical',
                }}
              />
            )}

            {editorMode === 'preview' && (
              <div id="booklet-preview" className="booklet-preview" data-print-ready={booklet && reference && reportDone ? '1' : '0'}>
                {includeCovers && (
                  <BookletCover line={reference?.species.species ?? report?.species.name ?? booklet?.title ?? ''} />
                )}
                <ChapterBody
                  content={booklet?.content ?? ''}
                  fallbackTitle={booklet?.title ?? ''}
                  latinName={reference?.species.species ?? report?.species.name ?? ''}
                />
                {includeReport && report && <AdvancedReport report={report} />}
                <div className="booklet-footer">
                  &copy; {new Date().getFullYear()} Bonsai Australis. All rights reserved. This booklet may not be
                  reproduced or redistributed without permission.
                </div>
                {includeCovers && <BookletClosing />}
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;0,9..144,700;1,9..144,500&family=IBM+Plex+Sans:wght@400;500;600&family=Cinzel:wght@600&display=swap');

        /* Chapter + report styling follows chapter-01-queensland-bottle-tree-REFERENCE.pdf.
           Tokens first so the whole look can be re-themed in one place. */
        .booklet-preview {
          --bk-cream: #FBF7EC;
          --bk-ink: #2E2510;
          --bk-gold: #D9A02B;
          --bk-green: #55702A;
          --bk-band: #E9E8D6;
          --bk-hair: #DAD6C4;
          --bk-muted: #8A7F63;
          box-sizing: border-box;
          max-width: 760px;
          margin: 0 auto;
          padding: 28px 40px 24px;
          background: var(--bk-cream);
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
          font-size: 15px;
          line-height: 1.75;
          color: var(--bk-ink);
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .chapter-header { text-align: center; margin-bottom: 28px; }
        .chapter-eyebrow {
          font-size: 12px;
          letter-spacing: 4px;
          color: var(--bk-gold);
          font-weight: 600;
          margin-bottom: 10px;
        }
        .chapter-title {
          font-family: 'Fraunces', Georgia, serif;
          font-size: 38px;
          line-height: 1.15;
          font-weight: 700;
          margin: 0 0 14px;
          color: var(--bk-ink);
        }
        .chapter-latin {
          font-family: 'Fraunces', Georgia, serif;
          font-style: italic;
          font-size: 22px;
          color: var(--bk-green);
        }
        .chapter-rule { width: 96px; height: 2px; background: var(--bk-gold); margin: 20px auto 0; }
        .chapter-text h2 {
          font-family: 'Fraunces', Georgia, serif;
          font-size: 24px;
          font-weight: 700;
          color: var(--bk-green);
          margin: 34px 0 14px;
          padding-bottom: 6px;
          border-bottom: 1px solid var(--bk-hair);
        }
        .chapter-text p { margin: 0 0 14px; }
        .chapter-text hr { border: none; border-top: 1px solid var(--bk-hair); margin: 32px 0; }
        .chapter-text strong { color: var(--bk-ink); }

        /* Cover and closing pages */
        .booklet-page {
          container-type: inline-size;
          position: relative;
          width: 100%;
          aspect-ratio: 210 / 297;
          background-color: #1f1f22;
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          border-radius: 4px;
          margin: 0 auto 28px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .booklet-cover { background-image: url('/booklet/cover-blank.jpg'); }
        .booklet-closing { background-image: url('/booklet/closing.jpg'); margin: 28px auto 0; }
        .booklet-cover-line {
          position: absolute;
          left: 11%;
          width: 80.6%;
          top: 71.8%;
          transform: translateY(-50%);
          text-align: center;
          white-space: nowrap;
          text-transform: capitalize;
          font-family: 'Cinzel', Georgia, serif;
          font-weight: 600;
          line-height: 1.2;
          background: linear-gradient(180deg, #e9c880 0%, #cf9c3f 50%, #a4731f 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.55));
        }

        /* Part Two */
        .report { margin-top: 56px; }
        .report-start { break-before: page; page-break-before: always; }
        .report-disclaimer {
          font-style: italic;
          font-size: 12px;
          line-height: 1.5;
          color: var(--bk-muted);
          max-width: 620px;
          margin: 16px auto 0;
        }
        .report-section { margin-bottom: 26px; }
        .report-band {
          font-family: 'Fraunces', Georgia, serif;
          font-size: 19px;
          font-weight: 600;
          background: var(--bk-band);
          margin: 0;
          padding: 10px 14px;
          break-after: avoid;
          page-break-after: avoid;
        }
        /* Rows are a two-column flex layout: a fixed-width label and a value column that is allowed to
           shrink (min-width: 0) and break long words. The earlier floated-label layout let a value
           run past the right edge of the printed page, where the print engine clipped it mid-word.
           Long rows are allowed to split across pages (see .report-row below). */
        .report-row {
          display: flex;
          gap: 18px;
          padding: 9px 0;
          border-bottom: 1px solid var(--bk-hair);
          font-size: 14px;
          line-height: 1.6;
          /* Long rows (Species Notes runs most of a page) may split across pages; keeping them whole
             left a big empty gap on the first Part Two page. orphans/widows stop one-line stragglers. */
          break-inside: auto;
          orphans: 3;
          widows: 3;
        }
        .report-label { flex: 0 0 34%; box-sizing: border-box; color: var(--bk-green); font-weight: 600; overflow-wrap: break-word; }
        .report-value { flex: 1 1 auto; min-width: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
        .not-printed { opacity: 0.55; }
        .internal-flag {
          display: inline-block;
          font-size: 10px;
          color: #8a4b00;
          background: #fdebc8;
          border-radius: 8px;
          padding: 0 6px;
          margin-left: 6px;
          vertical-align: middle;
        }
        .booklet-footer {
          margin-top: 40px;
          padding-top: 16px;
          border-top: 1px solid var(--bk-hair);
          font-size: 11px;
          color: var(--bk-muted);
          text-align: center;
        }

        @media print {
          /* Simpler, more robust approach than the previous visibility:hidden trick -
             that technique (hide everything, then re-show just .booklet-preview) is a
             known source of print-pagination bugs in some browsers, and was cutting
             content off partway through the document (truncating at "Wiring" on the
             first real test). Removing non-printable sections from layout entirely with
             display:none, then forcing the remaining flex layout back to a plain block,
             is the standard reliable pattern - nothing left for the print engine to get
             confused about. */
          .no-print { display: none !important; }
          .editor-flex-container {
            display: block !important;
            margin: 0 !important; /* the screen layout has a top margin that pushed the cover down 4mm */
          }
          .editor-column {
            width: 100% !important;
            max-width: 100% !important;
            flex: none !important;
          }
          .booklet-preview {
            width: auto;
            max-width: 100%;
            padding: 0;
            margin: 0;
          }
          .chapter-text h2 {
            page-break-after: avoid;
          }
          /* page-break-inside: avoid on paragraphs was removed here - it's the likely real
             cause of the truncation bug. Several paragraphs in this booklet are long enough
             that they don't fit within one printable page, and Chrome's known behaviour when
             it can't satisfy an "avoid break" constraint on tall content is to silently stop
             rendering the rest of the document rather than break the paragraph awkwardly
             across the page boundary. Letting paragraphs break normally is far safer - a
             paragraph split across two pages looks slightly less polished than one that
             doesn't, but a document that silently stops halfway through is a much worse
             outcome, and it's exactly what was happening. */
          /* A4, cream paper edge to edge, and a page number at the foot of each page.
             Printing with the browser's "Save as PDF" destination keeps these exactly; the
             Windows "Microsoft Print to PDF" printer ignores several of them. */
          html, body { background: #FBF7EC !important; }
          /* The root layout makes <body> a flex column, and this wrapper centres itself with
             margin: auto, which makes a flex item shrink to fit its widest content. A fixed-width
             child (the 210mm cover) or a long line then widened the whole wrapper past the page,
             and the print engine clipped everything beyond the right edge. Print as plain
             full-width blocks instead. */
          body { display: block !important; margin: 0 !important; }
          .booklet-shell {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Cover and closing pages are edge to edge A4 with no margin and no page number. */
          .booklet-page {
            page: fullbleed;
            width: 210mm;
            height: 296.8mm; /* a hair under the page so rounding can never spill a blank page */
            aspect-ratio: auto;
            border-radius: 0;
            margin: 0;
            overflow: hidden;
          }
          @page fullbleed {
            size: A4;
            margin: 0;
            background: #1f1f22;
            @bottom-center { content: none; }
          }
          @page {
            size: A4;
            margin: 16mm 17mm 18mm;
            background: #FBF7EC;
            @bottom-center {
              content: counter(page);
              font-family: 'IBM Plex Sans', sans-serif;
              font-size: 8pt;
              color: #8A7F63;
            }
          }
        }
      `}</style>
    </div>
  );
}
