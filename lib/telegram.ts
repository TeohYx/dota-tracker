// Minimal Telegram Bot API wrapper. Only the bits we use.

const TG_API = "https://api.telegram.org";

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN not set");
  return t;
}

export function botUsername(): string {
  return process.env.TELEGRAM_BOT_USERNAME ?? "";
}

export async function sendMessage(chatId: string, text: string): Promise<void> {
  const res = await fetch(`${TG_API}/bot${token()}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Telegram sendMessage ${res.status}: ${body.slice(0, 200)}`);
  }
}
