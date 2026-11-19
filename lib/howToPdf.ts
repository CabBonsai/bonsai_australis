// Renders the How To Guide PDF from already-fetched rows. No Supabase import, so it can be tested
// with fixture data. Cover = page 1, index = page 2, sections start on page 3.

import fs from 'fs/promises';
import path from 'path';
import chromium from '@sparticuz/chromium';
import puppeteer, { type Browser } from 'puppeteer-core';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { buildSections, coverHtml, indexHtml, sectionHtml, type SheetRows, type SheetSpecies } from './howToSheet';

async function loadLogo(origin: string): Promise<string | null> {
  try {
    const buf = await fs.readFile(path.join(process.cwd(), 'public', 'logo.png'));
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    try {
      const res = await fetch(`${origin}/logo.png`);
      if (!res.ok) return null;
      return `data:image/png;base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
    } catch {
      return null;
    }
  }
}

async function htmlToPdf(browser: Browser, html: string): Promise<Uint8Array> {
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMediaType('print');
    return await page.pdf({ preferCSSPageSize: true, printBackground: true });
  } finally {
    await page.close();
  }
}

export type HowToResult = { pdf: Uint8Array; empty: boolean };

export async function renderHowToPdf(opts: {
  species: SheetSpecies;
  rows: SheetRows;
  aspectIds: string[];
  origin: string;
  guides?: Record<string, string>;
}): Promise<HowToResult> {
  const { species, rows, aspectIds, origin, guides } = opts;
  const sections = buildSections(rows, aspectIds, guides ?? {});
  if (!sections.length) return { pdf: new Uint8Array(), empty: true };

  const executablePath = process.env.PDF_CHROMIUM_PATH || (await chromium.executablePath());
  const browser = await puppeteer.launch({
    args: process.env.PDF_CHROMIUM_PATH ? ['--no-sandbox'] : chromium.args,
    executablePath,
    headless: true,
  });
  try {
    const dateLabel = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane' }).format(new Date());
    const logo = await loadLogo(origin);

    const sectionPdfs: PDFDocument[] = [];
    for (const s of sections) sectionPdfs.push(await PDFDocument.load(await htmlToPdf(browser, sectionHtml(s))));

    let next = 3;
    const entries = sections.map((s, i) => {
      const e = { title: s.title, page: next };
      next += sectionPdfs[i].getPageCount();
      return e;
    });

    const cover = await PDFDocument.load(await htmlToPdf(browser, coverHtml({ logoDataUri: logo, species, sections, dateLabel })));
    const index = await PDFDocument.load(await htmlToPdf(browser, indexHtml(entries)));

    const out = await PDFDocument.create();
    // Cover is forced to a single page and the index to one page (a sheet has at most 8 aspects).
    for (const p of await out.copyPages(cover, [0])) out.addPage(p);
    for (const p of await out.copyPages(index, [0])) out.addPage(p);
    for (const d of sectionPdfs) for (const p of await out.copyPages(d, d.getPageIndices())) out.addPage(p);

    const font = await out.embedFont(StandardFonts.Helvetica);
    const total = out.getPageCount();
    out.getPages().forEach((pg, i) => {
      if (i === 0) return; // no number on the cover
      const { width } = pg.getSize();
      const label = `\u00A9 ${new Date().getFullYear()} Bonsai Australis  |  ${species.species}  |  ${i + 1} of ${total}`;
      const w = font.widthOfTextAtSize(label, 8);
      pg.drawText(label, { x: (width - w) / 2, y: 24, size: 8, font, color: rgb(0.45, 0.45, 0.4) });
    });
    out.setTitle(`${species.species} - How To Guide`);
    out.setAuthor('Bonsai Australis');
    return { pdf: await out.save(), empty: false };
  } finally {
    await browser.close();
  }
}
