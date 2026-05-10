import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { clearTelegramChatId } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  await clearTelegramChatId(user.id);
  return NextResponse.json({ ok: true });
}
