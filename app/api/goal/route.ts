import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteGoal, getGoal, upsertGoal } from "@/lib/db";

export const dynamic = "force-dynamic";

const goalSchema = z.object({
  account_id: z.number().int().positive(),
  start_mmr: z.number().int().min(0).max(15000),
  target_mmr: z.number().int().min(1).max(15000),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  mmr_per_win: z.number().int().min(10).max(50).default(30)
}).refine(v => v.target_mmr > v.start_mmr, {
  message: "target_mmr must be greater than start_mmr",
  path: ["target_mmr"]
}).refine(v => new Date(`${v.deadline}T23:59:59Z`).getTime() > Date.now(), {
  message: "deadline must be in the future",
  path: ["deadline"]
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const accountId = Number(url.searchParams.get("account_id"));
  if (!Number.isFinite(accountId) || accountId <= 0) {
    return NextResponse.json({ error: "Invalid account_id" }, { status: 400 });
  }
  const goal = await getGoal(accountId);
  return NextResponse.json(goal);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = goalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const goal = await upsertGoal(parsed.data);
  return NextResponse.json(goal, { status: 200 });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const accountId = Number(url.searchParams.get("account_id"));
  if (!Number.isFinite(accountId) || accountId <= 0) {
    return NextResponse.json({ error: "Invalid account_id" }, { status: 400 });
  }
  await deleteGoal(accountId);
  return NextResponse.json({ ok: true });
}
