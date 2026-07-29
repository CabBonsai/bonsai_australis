import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, admin_notes } = body;

    if (!id || !status || (status !== 'approved' && status !== 'rejected')) {
      return NextResponse.json(
        { error: 'Missing or invalid id/status. Status must be "approved" or "rejected".' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseServer
      .from('community_submissions')
      .update({
        status,
        admin_notes: admin_notes ?? undefined,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
