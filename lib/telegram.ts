// Minimal Telegram Bot API wrapper. Only the bits we use.

const TG_API = "https://api.telegram.org";

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN not set");
  return t;
}

export function botUsername(): string {
  // Without the @ prefix. Used to build t.me deep links.
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

// One-shot: register the webhook URL with Telegram. Run from a setup script.
export async function setWebhook(url: string, secretToken: string): Promise<unknown> {
  const res = await fetch(`${TG_API}/bot${token()}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url,
      secret_token: secretToken,
      allowed_updates: ["message"]
    })
  });
  return res.json();
}
