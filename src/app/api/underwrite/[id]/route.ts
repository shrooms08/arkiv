import { NextResponse } from "next/server";

import { findRecord } from "@/lib/underwriting/lookup";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const record = findRecord(id);
  if (!record) {
    return NextResponse.json({ error: `No thesis recorded for ${id}.` }, { status: 404 });
  }
  return NextResponse.json(record);
}
