import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, getPrincipal } from "@/lib/auth";
import { getUserById, setUserAccountId } from "@/lib/db";

export const dynamic = "force-dynamic";

const accountSchema = z.object({
  account_id: z.number().int().positive().max(2_000_000_000)
});

export async function GET() {
  const principal = await getPrincipal();
  if (!principal) return NextResponse.json({ error: "auth required" }, { status: 401 });
  if (principal.kind === "guest") {
    return NextResponse.json({ kind: "guest" });
  }
  return NextResponse.json({ kind: "user", user: principal.user });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = accountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid account_id" }, { status: 400 });
  }
  await setUserAccountId(user.id, parsed.data.account_id);
  const updated = await getUserById(user.id);
  return NextResponse.json(updated);
}
