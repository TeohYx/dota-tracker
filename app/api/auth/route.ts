import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Logout
export async function DELETE() {
  clearAuthCookie();
  return NextResponse.json({ ok: true });
}
