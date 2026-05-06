import { redirect } from "next/navigation";
import { isAuthenticated, setAuthCookie, checkPassword } from "@/lib/auth";

async function loginAction(formData: FormData) {
  "use server";
  const pw = String(formData.get("password") ?? "");
  if (!checkPassword(pw)) {
    redirect("/login?error=1");
  }
  setAuthCookie("main");
  redirect("/");
}

async function guestAction() {
  "use server";
  setAuthCookie("guest");
  redirect("/");
}

export default function LoginPage({
  searchParams
}: {
  searchParams: { error?: string };
}) {
  if (isAuthenticated()) redirect("/");
  const hasError = !!searchParams.error;
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="card w-full max-w-sm flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-bold">Dota 2 MMR Tracker</h1>
          <p className="text-xs text-muted">Sign in, or peek as a guest.</p>
        </div>

        <form action={loginAction} className="flex flex-col gap-3">
          <label className="block">
            <span className="label">Password</span>
            <input
              name="password"
              type="password"
              className="input"
              autoFocus
              required
            />
          </label>
          {hasError && (
            <div className="rounded-md border border-lose/40 bg-lose/10 px-3 py-2 text-xs text-lose">
              Wrong password.
            </div>
          )}
          <button className="btn" type="submit">Sign in</button>
        </form>

        <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted">
          <span className="h-px flex-1 bg-border" />
          <span>or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <form action={guestAction}>
          <button className="btn-ghost w-full" type="submit">
            Access as guest
          </button>
        </form>

        <p className="text-[11px] text-muted">
          Guests can view the dashboard read-only — they can&apos;t set or reset goals.
        </p>
      </div>
    </main>
  );
}
