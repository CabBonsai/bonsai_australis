// How To Guide builder: pure functions (no server imports) that turn database rows into the HTML
// for each part of the PDF: cover, index and one document per care aspect.
// The route renders each part in headless Chromium, counts pages, then merges them.

import { ASPECTS, type Aspect } from './howToAspects';
import { PRINT_BLOCK, formatValue } from './advancedReport';

export type SheetSpecies = { sp_no: number; species: string; common_name: string | null };
export type SheetRows = Record<string, Record<string, unknown> | null | undefined>;
export type SheetItem = { label: string; text: string };
export type SheetSection = { id: string; title: string; items: SheetItem[]; html?: string };

// A row is skipped when its table's research_status is 'Not Started' (template or empty rows).
function tableUsable(row: Record<string, unknown> | null | undefined): row is Record<string, unknown> {
  if (!row) return false;
  const st = String(row.research_status ?? '').trim().toLowerCase();
  return st !== 'not started';
}

export function buildSections(rows: SheetRows, aspectIds: string[], guides: Record<string, string> = {}): SheetSection[] {
  const wanted = new Set(aspectIds);
  const out: SheetSection[] = [];
  for (const aspect of ASPECTS as Aspect[]) {
    if (!wanted.has(aspect.id)) continue;
    if (guides[aspect.id]) { out.push(...guideSections(aspect.id, guides[aspect.id])); continue; } // a written guide replaces the short database text
    const items: SheetItem[] = [];
    for (const src of aspect.sources) {
      const row = rows[src.table];
      if (!tableUsable(row)) continue;
      for (const r of src.rows) {
        const text = formatValue(row[r.field]);
        if (!text) continue;
        if (PRINT_BLOCK.test(text)) continue; // working-note wording is held back until reworded
        items.push({ label: r.label, text });
      }
    }
    if (items.length) out.push({ id: aspect.id, title: aspect.title, items });
  }
  return out;
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function textToHtml(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let html = '';
  let inList = false;
  for (const l of lines) {
    const m = /^[-•*]\s+(.*)$/.exec(l);
    if (m) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${esc(m[1])}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<p>${esc(l)}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return html;
}

const CSS = `
@page { size: A4; margin: 22mm 18mm 24mm 18mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: Georgia, 'Times New Roman', serif; color: #2b2a25; font-size: 10.5pt; line-height: 1.5; }
h1, h2, h3 { font-family: 'Helvetica Neue', Arial, sans-serif; color: #3f5228; margin: 0; }
h2 { font-size: 17pt; border-bottom: 2px solid #3f5228; padding-bottom: 6px; margin-bottom: 14px; }
h3 { font-size: 11pt; margin: 14px 0 3px; color: #5a6b3c; break-after: avoid; }
p { margin: 0 0 6px; }
ul { margin: 0 0 6px; padding-left: 18px; }
li { margin-bottom: 3px; }
.item { break-inside: auto; }
`;

export function wrapDoc(body: string, extraCss = ''): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}${extraCss}</style></head><body>${body}</body></html>`;
}

export function sectionHtml(section: SheetSection): string {
  if (section.html) return wrapDoc(`<h2>${esc(section.title)}</h2>${section.html}`, GUIDE_CSS);
  const body =
    `<h2>${esc(section.title)}</h2>` +
    section.items.map((i) => `<div class="item"><h3>${esc(i.label)}</h3>${textToHtml(i.text)}</div>`).join('');
  return wrapDoc(body);
}

export function coverHtml(opts: {
  logoDataUri: string | null;
  species: SheetSpecies;
  sections: SheetSection[];
  dateLabel: string;
}): string {
  const { logoDataUri, species, sections, dateLabel } = opts;
  const year = new Date().getFullYear();
  const css = `
  @page { margin: 0; }
  .cover { height: 297mm; padding: 28mm 22mm; display: flex; flex-direction: column; align-items: center; text-align: center; background: #fff; }
  .cover img { width: 62mm; height: 62mm; object-fit: contain; margin-bottom: 8mm; }
  .brand { font-family: 'Helvetica Neue', Arial, sans-serif; letter-spacing: 6px; font-size: 26pt; color: #3f5228; font-weight: 700; text-transform: uppercase; }
  .rule { width: 60mm; border-top: 2px solid #3f5228; margin: 9mm 0; }
  .kind { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12pt; letter-spacing: 3px; text-transform: uppercase; color: #5a6b3c; }
  .latin { font-size: 24pt; font-style: italic; color: #2b2a25; margin: 6mm 0 2mm; }
  .common { font-size: 14pt; color: #555; }
  .details { margin-top: 14mm; font-size: 10.5pt; line-height: 1.7; max-width: 130mm; }
  .details b { font-family: 'Helvetica Neue', Arial, sans-serif; color: #3f5228; }
  .note { margin-top: auto; font-size: 8pt; color: #555; max-width: 150mm; line-height: 1.45; }
  .note p { margin: 0 0 6px; }
  `;
  const topics = sections.map((s) => esc(s.title)).join(' · ');
  const body = `<div class="cover">
    ${logoDataUri ? `<img src="${logoDataUri}" alt="Bonsai Australis">` : ''}
    <div class="brand">Bonsai Australis</div>
    <div class="rule"></div>
    <div class="kind">How To Guide</div>
    <div class="latin">${esc(species.species)}</div>
    ${species.common_name ? `<div class="common">${esc(species.common_name)}</div>` : ''}
    <div class="details">
      <div><b>Covers:</b> ${topics}</div>
      <div><b>Sections:</b> ${sections.length}</div>
      <div><b>Prepared:</b> ${esc(dateLabel)}</div>
      <div><b>Timing basis:</b> Southern Hemisphere (Australian seasons)</div>
    </div>
    <div class="note">
      <p>Prepared from the Bonsai Australis species database. Timing and technique vary with your local climate, elevation and the individual tree; treat this as a guide and adjust to what your tree is doing. It is general information only and comes with no warranty.</p>
      <p><b>&copy; ${year} Bonsai Australis. All rights reserved.</b> This guide may be printed or copied for your own personal use. No part of it may be reproduced, shared, sold or published without written permission from Bonsai Australis. Sources are credited to their original authors, and their content remains theirs.</p>
    </div>
  </div>`;
  return wrapDoc(body, css);
}

export function indexHtml(entries: { title: string; page: number }[]): string {
  const css = `
  .toc { list-style: none; padding: 0; margin: 0; }
  .toc li { display: flex; align-items: baseline; font-size: 12pt; margin-bottom: 10px; }
  .toc .t { white-space: nowrap; }
  .toc .dots { flex: 1; border-bottom: 1px dotted #999; margin: 0 8px; transform: translateY(-3px); }
  .toc .p { font-family: 'Helvetica Neue', Arial, sans-serif; color: #3f5228; font-weight: 700; }
  `;
  const body =
    `<h2>Index</h2><ul class="toc">` +
    entries
      .map((e) => `<li><span class="t">${esc(e.title)}</span><span class="dots"></span><span class="p">${e.page}</span></li>`)
      .join('') +
    `</ul>`;
  return wrapDoc(body, css);
}

// ---- Written guides (care_guides.body_md): small markdown subset --------------------------------
// `# ` title (ignored; the cover carries it), `## ` section (one per index entry), `### ` sub-heading,
// `- ` bullets, `1. ` numbered steps, pipe tables, blank-line separated paragraphs.

const GUIDE_CSS = `
table { border-collapse: collapse; width: 100%; margin: 8px 0 12px; font-size: 9pt; line-height: 1.35; break-inside: auto; }
th { background: none; color: #3f5228; text-align: left; padding: 5px 7px; border-top: 1.5px solid #3f5228; border-bottom: 1.5px solid #3f5228; font-family: 'Helvetica Neue', Arial, sans-serif; font-weight: 700; }
td { border-bottom: 1px solid #d9d4c0; padding: 5px 7px; vertical-align: top; }
tr { break-inside: avoid; }
ol { margin: 0 0 6px; padding-left: 20px; }
`;

function cells(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

export function markdownToHtml(md: string): string {
  const lines = md.split(/\r?\n/);
  let html = '';
  let i = 0;
  while (i < lines.length) {
    const l = lines[i].trim();
    if (!l) { i++; continue; }
    if (l.startsWith('### ')) { html += `<h3>${esc(l.slice(4))}</h3>`; i++; continue; }
    if (l.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        if (!/^\|?\s*:?-{2,}/.test(lines[i].trim())) rows.push(cells(lines[i]));
        i++;
      }
      const [head, ...body] = rows;
      html += `<table><thead><tr>${head.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>` +
        body.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') + `</tbody></table>`;
      continue;
    }
    if (/^- /.test(l)) {
      html += '<ul>';
      while (i < lines.length && /^- /.test(lines[i].trim())) { html += `<li>${esc(lines[i].trim().slice(2))}</li>`; i++; }
      html += '</ul>';
      continue;
    }
    if (/^\d+\.\s/.test(l)) {
      html += '<ol>';
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) { html += `<li>${esc(lines[i].trim().replace(/^\d+\.\s/, ''))}</li>`; i++; }
      html += '</ol>';
      continue;
    }
    html += `<p>${esc(l)}</p>`;
    i++;
  }
  return html;
}

export function guideSections(taskId: string, md: string): SheetSection[] {
  const out: SheetSection[] = [];
  let cur: { title: string; body: string[] } | null = null;
  for (const line of md.split(/\r?\n/)) {
    if (line.startsWith('## ')) {
      if (cur) out.push({ id: taskId, title: cur.title, items: [], html: markdownToHtml(cur.body.join('\n')) });
      cur = { title: line.slice(3).trim(), body: [] };
    } else if (cur) cur.body.push(line);
  }
  if (cur) out.push({ id: taskId, title: cur.title, items: [], html: markdownToHtml(cur.body.join('\n')) });
  return out;
}
