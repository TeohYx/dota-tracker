import { NextResponse } from "next/server";
import { fetchMatches } from "@/lib/opendota";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: { id: string } }) {
  if (!isAuthenticated()) return NextResponse.json({ error: "auth required" }, { status: 401 });
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid account id" }, { status: 400 });
  }
  const url = new URL(req.url);
  const days = Math.max(1, Math.min(Number(url.searchParams.get("days") ?? 90), 365));
  const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") ?? 500), 1000));
  try {
    const matches = await fetchMatches(id, { days, limit });
    return NextResponse.json(matches, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "fetch failed" }, { status: 502 });
  }
}
