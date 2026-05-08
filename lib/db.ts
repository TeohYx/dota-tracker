import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Goal, User } from "./types";

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
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      account_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);

  // Migration: the old goals table was keyed by account_id. If we detect that
  // shape, drop it — this app moved from single-user to per-user goals and the
  // old rows can't be linked back to a user.
  const cols = await c.execute(`PRAGMA table_info(goals)`);
  const colNames = cols.rows.map((r: any) => String(r.name));
  if (colNames.length > 0 && !colNames.includes("user_id")) {
    await c.execute(`DROP TABLE goals`);
  }

  await c.execute(`
    CREATE TABLE IF NOT EXISTS goals (
      user_id     INTEGER PRIMARY KEY,
      start_mmr   INTEGER NOT NULL,
      target_mmr  INTEGER NOT NULL,
      deadline    TEXT NOT NULL,
      mmr_per_win INTEGER NOT NULL DEFAULT 25,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);

  initialized = true;
}

function rowToUser(row: any): User {
  return {
    id: Number(row.id),
    email: String(row.email),
    account_id: row.account_id == null ? null : Number(row.account_id),
    created_at: String(row.created_at)
  };
}

export async function getUserById(id: number): Promise<User | null> {
  await ensureSchema();
  const res = await getClient().execute({
    sql: "SELECT id, email, account_id, created_at FROM users WHERE id = ?",
    args: [id]
  });
  const row = res.rows[0];
  return row ? rowToUser(row) : null;
}

export async function getUserByEmail(email: string): Promise<(User & { password_hash: string }) | null> {
  await ensureSchema();
  const res = await getClient().execute({
    sql: "SELECT id, email, account_id, created_at, password_hash FROM users WHERE email = ?",
    args: [email]
  });
  const row = res.rows[0];
  if (!row) return null;
  return { ...rowToUser(row), password_hash: String(row.password_hash) };
}

export async function createUser(input: { email: string; password_hash: string }): Promise<User> {
  await ensureSchema();
  const res = await getClient().execute({
    sql: `INSERT INTO users (email, password_hash) VALUES (?, ?)
          RETURNING id, email, account_id, created_at`,
    args: [input.email, input.password_hash]
  });
  const row = res.rows[0];
  if (!row) throw new Error("Failed to create user");
  return rowToUser(row);
}

export async function setUserAccountId(userId: number, accountId: number): Promise<void> {
  await ensureSchema();
  await getClient().execute({
    sql: "UPDATE users SET account_id = ? WHERE id = ?",
    args: [accountId, userId]
  });
}

function rowToGoal(row: any): Goal {
  return {
    user_id: Number(row.user_id),
    start_mmr: Number(row.start_mmr),
    target_mmr: Number(row.target_mmr),
    deadline: String(row.deadline),
    mmr_per_win: Number(row.mmr_per_win),
    created_at: String(row.created_at)
  };
}

export async function getGoal(userId: number): Promise<Goal | null> {
  await ensureSchema();
  const res = await getClient().execute({
    sql: "SELECT user_id, start_mmr, target_mmr, deadline, mmr_per_win, created_at FROM goals WHERE user_id = ?",
    args: [userId]
  });
  const row = res.rows[0];
  return row ? rowToGoal(row) : null;
}

export async function upsertGoal(input: {
  user_id: number;
  start_mmr: number;
  target_mmr: number;
  deadline: string;
  mmr_per_win: number;
}): Promise<Goal> {
  await ensureSchema();
  await getClient().execute({
    sql: `INSERT INTO goals (user_id, start_mmr, target_mmr, deadline, mmr_per_win, created_at)
          VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
          ON CONFLICT(user_id) DO UPDATE SET
            start_mmr = excluded.start_mmr,
            target_mmr = excluded.target_mmr,
            deadline = excluded.deadline,
            mmr_per_win = excluded.mmr_per_win,
            created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    args: [input.user_id, input.start_mmr, input.target_mmr, input.deadline, input.mmr_per_win]
  });
  const goal = await getGoal(input.user_id);
  if (!goal) throw new Error("Failed to persist goal");
  return goal;
}

export async function deleteGoal(userId: number): Promise<void> {
  await ensureSchema();
  await getClient().execute({
    sql: "DELETE FROM goals WHERE user_id = ?",
    args: [userId]
  });
}
