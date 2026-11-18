import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { ASPECTS, ASPECT_IDS } from '@/lib/howToAspects';
import { renderHowToPdf } from '@/lib/howToPdf';

// GET /api/how-to-sheet/pdf?sp_no=11326&aspects=pruning,wiring
// Builds a cover + index + per-aspect care sheet from the species' database rows. Access is
// enforced by middleware.ts (admin_auth cookie).
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const spNo = Number(request.nextUrl.searchParams.get('sp_no'));
  if (!Number.isInteger(spNo) || spNo <= 0) {
    return NextResponse.json({ error: 'sp_no is required' }, { status: 400 });
  }
  const raw = request.nextUrl.searchParams.get('aspects');
  const aspectIds = raw ? raw.split(',').map((s) => s.trim()).filter((s) => ASPECT_IDS.includes(s)) : ASPECT_IDS;
  if (!aspectIds.length) return NextResponse.json({ error: 'No valid aspects selected' }, { status: 400 });

  const { data: sp, error: spErr } = await supabaseServer
    .from('species')
    .select('sp_no, species, common_name')
    .eq('sp_no', spNo)
    .maybeSingle();
  if (spErr || !sp) return NextResponse.json({ error: 'Species not found' }, { status: 404 });

  const tables = Array.from(new Set(ASPECTS.filter((a) => aspectIds.includes(a.id)).flatMap((a) => a.sources.map((s) => s.table))));
  const rows: Record<string, Record<string, unknown> | null> = {};
  await Promise.all(
    tables.map(async (t) => {
      const { data } = await supabaseServer.from(t).select('*').eq('sp_no', spNo).maybeSingle();
      rows[t] = (data as Record<string, unknown> | null) ?? null;
    }),
  );

  const guides: Record<string, string> = {};
  const { data: gs } = await supabaseServer.from('care_guides').select('task, body_md').eq('sp_no', spNo).in('task', aspectIds);
  for (const g of gs ?? []) guides[g.task as string] = g.body_md as string;

  try {
    const origin = process.env.PDF_RENDER_ORIGIN || request.nextUrl.origin;
    const { pdf, empty } = await renderHowToPdf({ species: sp, rows, aspectIds, origin, guides });
    if (empty) {
      return NextResponse.json({ error: 'No reader-ready content for the selected topics yet' }, { status: 404 });
    }
    const name = `${sp.species}_How_To_Guide`.replace(/[^A-Za-z0-9 _-]+/g, '').trim().replace(/\s+/g, '_');
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${name}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: `PDF render failed: ${e?.message ?? e}` }, { status: 500 });
  }
}
