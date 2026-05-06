import { cookies } from "next/headers";
import crypto from "node:crypto";
import type { Role } from "./types";

const COOKIE_NAME = "d2t_auth";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const VALID_ROLES: Role[] = ["main", "guest"];

function secret(): string {
  return process.env.APP_SECRET || "insecure-dev-secret-please-set-APP_SECRET";
}

function password(): string {
  return process.env.APP_PASSWORD || "dota";
}

function sign(payload: string): string {
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function verify(token: string): Role | null {
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
  return (VALID_ROLES as string[]).includes(payload) ? (payload as Role) : null;
}

export function getRole(): Role | null {
  const c = cookies().get(COOKIE_NAME)?.value;
  return c ? verify(c) : null;
}

export function isAuthenticated(): boolean {
  return getRole() !== null;
}

export function isMain(): boolean {
  return getRole() === "main";
}

export function setAuthCookie(role: Role = "main"): void {
  cookies().set(COOKIE_NAME, sign(role), {
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

export function checkPassword(input: string): boolean {
  const expected = password();
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length || a.length === 0) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
