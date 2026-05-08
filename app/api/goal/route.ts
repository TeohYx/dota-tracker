import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteGoal, getGoal, upsertGoal } from "@/lib/db";
import { getCurrentUser, getPrincipal } from "@/lib/auth";

export const dynamic = "force-dynamic";

const goalSchema = z.object({
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

// GET returns the current viewer's goal. Guests have no goal of their own; the
// dashboard surfaces the default account's profile for them but goals are
// per-user.
export async function GET() {
  const principal = await getPrincipal();
  if (!principal) return NextResponse.json({ error: "auth required" }, { status: 401 });
  if (principal.kind === "guest") return NextResponse.json(null);
  const goal = await getGoal(principal.user.id);
  return NextResponse.json(goal);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = goalSchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const fieldMsgs = Object.entries(flat.fieldErrors)
      .flatMap(([k, msgs]) => (msgs ?? []).map(m => `${k}: ${m}`));
    const message = [...flat.formErrors, ...fieldMsgs].join("; ") || "Invalid goal";
    return NextResponse.json({ error: message, details: flat }, { status: 400 });
  }
  const existing = await getGoal(user.id);
  if (existing) {
    return NextResponse.json(
      { error: "A goal is already locked. Reset it first to start over." },
      { status: 409 }
    );
  }
  try {
    const goal = await upsertGoal({ user_id: user.id, ...parsed.data });
    return NextResponse.json(goal, { status: 201 });
  } catch (err: any) {
    console.error("[/api/goal POST] upsert failed:", err);
    return NextResponse.json(
      { error: `Database error: ${err?.message ?? "unknown"}` },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  await deleteGoal(user.id);
  return NextResponse.json({ ok: true });
}
