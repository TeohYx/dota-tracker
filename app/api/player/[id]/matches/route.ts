import { NextResponse } from "next/server";
import { fetchRecentMatches } from "@/lib/opendota";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid account id" }, { status: 400 });
  }
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 30), 100);
  try {
    const matches = await fetchRecentMatches(id, limit);
    return NextResponse.json(matches, {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60" }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "fetch failed" }, { status: 502 });
  }
}
