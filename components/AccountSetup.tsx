"use client";

import { useState } from "react";
import type { User } from "@/lib/types";

export default function AccountSetup({
  user,
  onSaved
}: {
  user: User;
  onSaved: (updated: User) => void;
}) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    const id = Number(value);
    if (!Number.isFinite(id) || id <= 0) {
      setErr("Enter a valid Dota account ID (numbers only).");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch("/api/me", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account_id: id })
      });
      const j = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(j?.error ?? `HTTP ${res.status}`);
      onSaved(j as User);
    } catch (e: any) {
      setErr(e.message ?? "Could not save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-md card flex flex-col gap-4">
      <header>
        <h2 className="text-xl font-bold">Link your Dota 2 account</h2>
        <p className="mt-1 text-sm text-muted">
          Welcome, {user.email}. Enter your Steam32 account ID to start tracking.
        </p>
      </header>

      <label className="block">
        <span className="label">Dota 2 account ID</span>
        <input
          className="input mt-1 text-lg"
          type="number"
          inputMode="numeric"
          min={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 403281874"
          autoFocus
          required
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
        />
        <span className="mt-1 block text-xs text-muted">
          You can find this on your OpenDota or Dotabuff profile URL — the number after <code>/players/</code>.
        </span>
      </label>

      {err && (
        <div className="rounded-md border border-lose/40 bg-lose/10 px-3 py-2 text-xs text-lose">
          {err}
        </div>
      )}

      <button className="btn" type="button" disabled={submitting || !value} onClick={save}>
        {submitting ? "Saving…" : "Continue"}
      </button>
    </section>
  );
}
