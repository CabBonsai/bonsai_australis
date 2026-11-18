import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

// GET /api/how-to-sheet/tasks?sp_no=11380 -> { guides: ['pruning'] } (tasks that have a written guide)
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const spNo = Number(request.nextUrl.searchParams.get('sp_no'));
  if (!Number.isInteger(spNo) || spNo <= 0) return NextResponse.json({ guides: [] });
  const { data } = await supabaseServer.from('care_guides').select('task').eq('sp_no', spNo);
  return NextResponse.json({ guides: (data ?? []).map((d) => d.task as string) });
}
