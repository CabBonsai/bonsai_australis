import { NextRequest, NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

// Server-side booklet PDF. Opens the real Booklet Studio preview in headless Chromium and prints
// it, so the file is identical on every device (iOS Safari ignores the print settings the page
// relies on: full-bleed cover, margins, page numbers).
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const spNo = Number(request.nextUrl.searchParams.get('sp_no'));
  if (!Number.isInteger(spNo) || spNo <= 0) {
    return NextResponse.json({ error: 'sp_no is required' }, { status: 400 });
  }
  const covers = request.nextUrl.searchParams.get('covers') === '0' ? '0' : '1';
  const report = request.nextUrl.searchParams.get('report') === '0' ? '0' : '1';
  const cookie = request.cookies.get('admin_auth')?.value;
  // Access is already enforced by middleware.ts; the cookie is only forwarded to the page we render.

  // PDF_RENDER_ORIGIN lets a local test point at the dev server; otherwise render via this deployment.
  const origin = process.env.PDF_RENDER_ORIGIN || request.nextUrl.origin;
  const executablePath = process.env.PDF_CHROMIUM_PATH || (await chromium.executablePath());

  const browser = await puppeteer.launch({
    args: process.env.PDF_CHROMIUM_PATH ? ['--no-sandbox'] : chromium.args,
    executablePath,
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });
    const host = new URL(origin);
    if (cookie) await page.setCookie({ name: 'admin_auth', value: cookie, domain: host.hostname, path: '/' });
    await page.goto(`${origin}/booklets?print=${spNo}&covers=${covers}&report=${report}`, {
      waitUntil: 'networkidle0',
      timeout: 45000,
    });
    await page.waitForSelector('[data-print-ready="1"]', { timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMediaType('print');
    // Avoid a stray, almost-empty page when Part One runs just over a page boundary: measure the
    // chapter at the printed text width and, only if its last page would hold a few lines, tighten
    // the spacing very slightly (never more than ~8%) so it fits on the pages before it.
    await page.setViewport({ width: 665, height: 1123 }); // A4 less 17mm side margins, in CSS px
    await page.evaluate(() => {
      const header = document.querySelector('.chapter-header:not(.report-start)') as HTMLElement | null;
      const text = document.querySelector('.chapter-text') as HTMLElement | null;
      if (!header || !text) return;
      const PAGE = (297 - 16 - 18) * 3.7795; // printable height of one page in CSS px
      // Real page breaks waste a few percent (headings are kept with their text, widows/orphans), so
      // the continuous-flow height is scaled up by an allowance before counting pages.
      const LOSS = 1.05;
      const measure = () => (text.getBoundingClientRect().bottom - header.getBoundingClientRect().top) * LOSS;
      const cs = getComputedStyle(text);
      const baseLh = parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) || 1.7;
      const H0 = measure();
      const n = Math.ceil(H0 / PAGE);
      const tail = H0 - (n - 1) * PAGE;
      if (n < 2 || tail > 0.3 * PAGE) return; // fine as it is
      for (let f = 0.99; f >= 0.92; f -= 0.01) {
        text.style.setProperty('--fit', String(f));
        text.style.lineHeight = String(baseLh * f);
        if (measure() <= (n - 1) * PAGE * 0.99) return; // fits with a little headroom
      }
      text.style.removeProperty('--fit'); // could not fit within 8%: leave it alone
      text.style.lineHeight = '';
    });
    await page.setViewport({ width: 794, height: 1123 });
    const title = await page.title();
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    const name = (title || `booklet-${spNo}`).replace(/[^A-Za-z0-9 _-]+/g, '').trim().replace(/\s+/g, '_') || `booklet-${spNo}`;
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${name}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: `PDF render failed: ${e?.message ?? e}` }, { status: 500 });
  } finally {
    await browser.close();
  }
}
