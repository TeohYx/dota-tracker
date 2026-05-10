// One-shot: register your Telegram bot's webhook URL.
//
// Usage (PowerShell):
//   $env:TELEGRAM_BOT_TOKEN="..."; $env:TELEGRAM_WEBHOOK_SECRET="..."
//   node scripts/set-telegram-webhook.mjs https://your-app.vercel.app
//
// Run this once after deploying (and any time the URL or secret changes).

const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error("Usage: node scripts/set-telegram-webhook.mjs <base-url>");
  process.exit(1);
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
if (!token || !secret) {
  console.error("TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET must be set in the environment.");
  process.exit(1);
}

const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/telegram/webhook`;
const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    url: webhookUrl,
    secret_token: secret,
    allowed_updates: ["message"]
  })
});
const body = await res.json();
console.log(JSON.stringify(body, null, 2));
if (!body.ok) process.exit(1);
console.log(`\nWebhook set to ${webhookUrl}`);
