import { NextResponse } from "next/server";
import { fetchPlayerSummary } from "@/lib/opendota";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  if (!isAuthenticated()) return NextResponse.json({ error: "auth required" }, { status: 401 });
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid account id" }, { status: 400 });
  }
  try {
    const summary = await fetchPlayerSummary(id);
    return NextResponse.json(summary, {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60" }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "fetch failed" }, { status: 502 });
  }
}
