// Destination: bonsai-admin/app/api/care-sheet-settings/update/route.ts
// Follows the same service-role pattern as variants / community-submissions routes.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { enabled, resetCount } = body as { enabled?: boolean; resetCount?: boolean };

    if (enabled === undefined && !resetCount) {
      return NextResponse.json(
        { error: 'Provide "enabled" (boolean) and/or "resetCount": true' },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (enabled !== undefined) updatePayload.enabled = enabled;
    if (resetCount) updatePayload.generation_count = 0;

    const { data, error } = await supabaseServer
      .from('care_sheet_settings')
      .update(updatePayload)
      .eq('id', 1)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, settings: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
