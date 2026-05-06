import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteGoal, getGoal, upsertGoal } from "@/lib/db";
import { isAuthenticated, isMain } from "@/lib/auth";

export const dynamic = "force-dynamic";

const goalSchema = z.object({
  account_id: z.number().int().positive(),
  start_mmr: z.number().int().min(0).max(15000),
  target_mmr: z.number().int().min(1).max(15000),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  mmr_per_win: z.number().int().min(10).max(50).default(25)
}).refine(v => v.target_mmr > v.start_mmr, {
  message: "Target MMR must be greater than current MMR",
  path: ["target_mmr"]
}).refine(v => new Date(`${v.deadline}T23:59:59Z`).getTime() > Date.now(), {
  message: "Deadline must be in the future",
  path: ["deadline"]
});

export async function GET(req: Request) {
  if (!isAuthenticated()) return NextResponse.json({ error: "auth required" }, { status: 401 });
  const url = new URL(req.url);
  const accountId = Number(url.searchParams.get("account_id"));
  if (!Number.isFinite(accountId) || accountId <= 0) {
    return NextResponse.json({ error: "Invalid account_id" }, { status: 400 });
  }
  const goal = await getGoal(accountId);
  return NextResponse.json(goal);
}

export async function POST(req: Request) {
  if (!isAuthenticated()) return NextResponse.json({ error: "auth required" }, { status: 401 });
  if (!isMain()) return NextResponse.json({ error: "guests cannot modify goals" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const parsed = goalSchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const fieldMsgs = Object.entries(flat.fieldErrors)
      .flatMap(([k, msgs]) => (msgs ?? []).map(m => `${k}: ${m}`));
    const message = [...flat.formErrors, ...fieldMsgs].join("; ") || "Invalid goal";
    return NextResponse.json({ error: message, details: flat }, { status: 400 });
  }
  // Lock semantics: refuse to overwrite an existing goal. Reset must go through DELETE.
  const existing = await getGoal(parsed.data.account_id);
  if (existing) {
    return NextResponse.json(
      { error: "A goal is already locked. Reset it first to start over." },
      { status: 409 }
    );
  }
  try {
    const goal = await upsertGoal(parsed.data);
    return NextResponse.json(goal, { status: 201 });
  } catch (err: any) {
    console.error("[/api/goal POST] upsert failed:", err);
    return NextResponse.json(
      { error: `Database error: ${err?.message ?? "unknown"}` },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  if (!isAuthenticated()) return NextResponse.json({ error: "auth required" }, { status: 401 });
  if (!isMain()) return NextResponse.json({ error: "guests cannot modify goals" }, { status: 403 });
  const url = new URL(req.url);
  const accountId = Number(url.searchParams.get("account_id"));
  if (!Number.isFinite(accountId) || accountId <= 0) {
    return NextResponse.json({ error: "Invalid account_id" }, { status: 400 });
  }
  await deleteGoal(accountId);
  return NextResponse.json({ ok: true });
}
