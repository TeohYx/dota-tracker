import { NextResponse } from "next/server";
import { consumeTelegramLinkCode } from "@/lib/db";
import { sendMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// Telegram POSTs updates here. We reject any request without the secret token
// header that we registered via setWebhook.
export async function POST(req: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const got = req.headers.get("x-telegram-bot-api-secret-token");
  if (!expected || got !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const update = await req.json().catch(() => null);
  const message = update?.message;
  const chatId = message?.chat?.id;
  const text: string | undefined = message?.text;
  if (!chatId || typeof text !== "string") {
    return NextResponse.json({ ok: true });
  }

  // We only handle the linking command: "/start <code>".
  const match = text.match(/^\/start(?:\s+([a-zA-Z0-9]+))?/);
  if (!match) {
    await sendMessage(String(chatId), "Send /start <code> to link your tracker, or generate a new link from the dashboard.");
    return NextResponse.json({ ok: true });
  }
  const code = match[1];
  if (!code) {
    await sendMessage(String(chatId), "Open your tracker dashboard and click <b>Enable notifications</b> to get a link.");
    return NextResponse.json({ ok: true });
  }

  const user = await consumeTelegramLinkCode(code, String(chatId));
  if (!user) {
    await sendMessage(String(chatId), "❌ That link is invalid or expired. Generate a new one from the dashboard.");
    return NextResponse.json({ ok: true });
  }

  await sendMessage(
    String(chatId),
    `✅ Notifications enabled for <b>${user.email}</b>. You'll get a ping after each ranked match and a daily summary at midnight (MY).`
  );
  return NextResponse.json({ ok: true });
}
