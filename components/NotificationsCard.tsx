"use client";

import { useState } from "react";
import type { User } from "@/lib/types";

export default function NotificationsCard({
  user,
  onChange
}: {
  user: User;
  onChange: (u: User) => void;
}) {
  const [working, setWorking] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function enable() {
    setWorking(true);
    setErr(null);
    try {
      const res = await fetch("/api/notify/start", { method: "POST" });
      const j = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(j?.error ?? `HTTP ${res.status}`);
      setLinkUrl(j.linkUrl);
    } catch (e: any) {
      setErr(e.message ?? "Could not generate link");
    } finally {
      setWorking(false);
    }
  }

  async function disable() {
    setWorking(true);
    setErr(null);
    try {
      const res = await fetch("/api/notify/disable", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as any));
        throw new Error(j?.error ?? `HTTP ${res.status}`);
      }
      onChange({ ...user, telegram_chat_id: null });
      setLinkUrl(null);
    } catch (e: any) {
      setErr(e.message ?? "Could not disable");
    } finally {
      setWorking(false);
    }
  }

  const enabled = !!user.telegram_chat_id;

  return (
    <section className="card flex flex-col gap-3">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">📲 Notifications</div>
          <div className="text-xs text-muted">
            {enabled
              ? "Connected to Telegram. You'll get a ping after each ranked match and a midnight (MY) summary."
              : "Get a Telegram ping after every match plus a daily summary at midnight (MY)."}
          </div>
        </div>
        {enabled && (
          <span className="rounded-full border border-win/40 bg-win/10 px-2 py-1 text-[11px] text-win">
            Enabled
          </span>
        )}
      </header>

      {err && (
        <div className="rounded-md border border-lose/40 bg-lose/10 px-3 py-2 text-xs text-lose">
          {err}
        </div>
      )}

      {!enabled && !linkUrl && (
        <button className="btn" type="button" disabled={working} onClick={enable}>
          {working ? "Generating link…" : "Enable notifications"}
        </button>
      )}

      {!enabled && linkUrl && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-panel2 p-3 text-sm">
          <div className="text-muted">
            Open this link on your phone (or desktop) — Telegram will launch the bot. Press <b>Start</b> to confirm.
          </div>
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn text-center"
          >
            Open Telegram
          </a>
          <div className="text-[11px] text-muted">
            Link expires in 10 minutes. Once linked, refresh this page.
          </div>
        </div>
      )}

      {enabled && (
        <button className="btn-ghost" type="button" disabled={working} onClick={disable}>
          {working ? "Disabling…" : "Disable notifications"}
        </button>
      )}
    </section>
  );
}
