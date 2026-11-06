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
  if (!cookie) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

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
    await page.setCookie({ name: 'admin_auth', value: cookie, domain: host.hostname, path: '/' });
    await page.goto(`${origin}/booklets?print=${spNo}&covers=${covers}&report=${report}`, {
      waitUntil: 'networkidle0',
      timeout: 45000,
    });
    await page.waitForSelector('[data-print-ready="1"]', { timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMediaType('print');
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
