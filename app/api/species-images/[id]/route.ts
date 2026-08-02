// app/api/species-images/[id]/route.ts  (bonsai-admin)
//
// DELETE only. species_images has no anon/authenticated DELETE policy, so
// removal has to go through this service-role route, same pattern as the
// rest of the admin API surface.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabaseServer";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing image id" }, { status: 400 });
  }

  const { error } = await supabaseServer.from("species_images").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: id });
}
