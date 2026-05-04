import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Goal } from "./types";

let client: Client | null = null;
let initialized = false;

function getClient(): Client {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL ?? "file:./data/tracker.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (url.startsWith("file:")) {
    const filePath = url.replace(/^file:/, "");
    try { mkdirSync(dirname(filePath), { recursive: true }); } catch { /* ignore */ }
  }
  client = createClient({ url, authToken });
  return client;
}

async function ensureSchema() {
  if (initialized) return;
  const c = getClient();
  await c.execute(`
    CREATE TABLE IF NOT EXISTS goals (
      account_id INTEGER PRIMARY KEY,
      start_mmr INTEGER NOT NULL,
      target_mmr INTEGER NOT NULL,
      deadline TEXT NOT NULL,
      mmr_per_win INTEGER NOT NULL DEFAULT 30,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  initialized = true;
}

export async function getGoal(accountId: number): Promise<Goal | null> {
  await ensureSchema();
  const res = await getClient().execute({
    sql: "SELECT account_id, start_mmr, target_mmr, deadline, mmr_per_win, created_at FROM goals WHERE account_id = ?",
    args: [accountId]
  });
  const row = res.rows[0];
  if (!row) return null;
  return {
    account_id: Number(row.account_id),
    start_mmr: Number(row.start_mmr),
    target_mmr: Number(row.target_mmr),
    deadline: String(row.deadline),
    mmr_per_win: Number(row.mmr_per_win),
    created_at: String(row.created_at)
  };
}

export async function upsertGoal(input: {
  account_id: number;
  start_mmr: number;
  target_mmr: number;
  deadline: string;
  mmr_per_win: number;
}): Promise<Goal> {
  await ensureSchema();
  await getClient().execute({
    sql: `INSERT INTO goals (account_id, start_mmr, target_mmr, deadline, mmr_per_win, created_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(account_id) DO UPDATE SET
            start_mmr = excluded.start_mmr,
            target_mmr = excluded.target_mmr,
            deadline = excluded.deadline,
            mmr_per_win = excluded.mmr_per_win,
            created_at = datetime('now')`,
    args: [input.account_id, input.start_mmr, input.target_mmr, input.deadline, input.mmr_per_win]
  });
  const goal = await getGoal(input.account_id);
  if (!goal) throw new Error("Failed to persist goal");
  return goal;
}

export async function deleteGoal(accountId: number): Promise<void> {
  await ensureSchema();
  await getClient().execute({
    sql: "DELETE FROM goals WHERE account_id = ?",
    args: [accountId]
  });
}
