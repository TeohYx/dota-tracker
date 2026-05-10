import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { setTelegramLinkCode } from "@/lib/db";
import { botUsername } from "@/lib/telegram";

export const dynamic = "force-dynamic";

const LINK_TTL_MS = 10 * 60 * 1000;

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  if (!botUsername()) {
    return NextResponse.json(
      { error: "Notifications not configured (TELEGRAM_BOT_USERNAME missing)." },
      { status: 503 }
    );
  }

  const code = crypto.randomBytes(8).toString("hex");
  const expiresAt = new Date(Date.now() + LINK_TTL_MS).toISOString();
  await setTelegramLinkCode(user.id, code, expiresAt);

  const linkUrl = `https://t.me/${botUsername()}?start=${code}`;
  return NextResponse.json({ linkUrl, expiresAt });
}
