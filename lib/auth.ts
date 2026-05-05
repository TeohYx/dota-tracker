import { cookies } from "next/headers";
import crypto from "node:crypto";

const COOKIE_NAME = "d2t_auth";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

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

function verify(token: string): boolean {
  const idx = token.lastIndexOf(".");
  if (idx < 0) return false;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  try {
    return crypto.timingSafeEqual(a, b) && payload === "main";
  } catch {
    return false;
  }
}

export function isAuthenticated(): boolean {
  const c = cookies().get(COOKIE_NAME)?.value;
  return !!c && verify(c);
}

export function setAuthCookie(): void {
  cookies().set(COOKIE_NAME, sign("main"), {
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
