import { cookies } from "next/headers";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { getUserById } from "./db";
import type { Principal, User } from "./types";

const COOKIE_NAME = "d2t_auth";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

const scrypt = promisify(crypto.scrypt) as (
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number
) => Promise<Buffer>;

function secret(): string {
  return process.env.APP_SECRET || "insecure-dev-secret-please-set-APP_SECRET";
}

function sign(payload: string): string {
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

// Cookie payload: "g" for guest, or numeric user id ("42") for an authenticated user.
type Payload = { kind: "guest" } | { kind: "user"; id: number };

function parsePayload(payload: string): Payload | null {
  if (payload === "g") return { kind: "guest" };
  if (/^\d+$/.test(payload)) return { kind: "user", id: Number(payload) };
  return null;
}

function verify(token: string): Payload | null {
  const idx = token.lastIndexOf(".");
  if (idx < 0) return null;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || a.length === 0) return null;
  try {
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return parsePayload(payload);
}

function readCookie(): Payload | null {
  const c = cookies().get(COOKIE_NAME)?.value;
  return c ? verify(c) : null;
}

export async function getPrincipal(): Promise<Principal | null> {
  const p = readCookie();
  if (!p) return null;
  if (p.kind === "guest") return { kind: "guest" };
  const user = await getUserById(p.id);
  if (!user) return null;
  return { kind: "user", user };
}

export async function getCurrentUser(): Promise<User | null> {
  const p = readCookie();
  if (!p || p.kind !== "user") return null;
  return getUserById(p.id);
}

export function isAuthenticated(): boolean {
  return readCookie() !== null;
}

export function setUserSessionCookie(userId: number): void {
  cookies().set(COOKIE_NAME, sign(String(userId)), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/"
  });
}

export function setGuestCookie(): void {
  cookies().set(COOKIE_NAME, sign("g"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/"
  });
}

export function clearAuthCookie(): void {
  cookies().delete(COOKIE_NAME);
}

// Password hashing: scrypt with a per-password salt. Format: scrypt$<saltHex>$<keyHex>.
const SCRYPT_KEY_LEN = 64;

export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(plain, salt, SCRYPT_KEY_LEN);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  const got = await scrypt(plain, salt, expected.length);
  if (got.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(got, expected);
  } catch {
    return false;
  }
}
