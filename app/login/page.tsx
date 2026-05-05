import { redirect } from "next/navigation";
import { isAuthenticated, setAuthCookie, checkPassword } from "@/lib/auth";

async function loginAction(formData: FormData) {
  "use server";
  const pw = String(formData.get("password") ?? "");
  if (!checkPassword(pw)) {
    redirect("/login?error=1");
  }
  setAuthCookie();
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
      <form
        action={loginAction}
        className="card w-full max-w-sm flex flex-col gap-4"
      >
        <div>
          <h1 className="text-xl font-bold">Dota 2 MMR Tracker</h1>
          <p className="text-xs text-muted">Enter your tracker password to continue.</p>
        </div>
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
        <p className="text-[11px] text-muted">
          Single-user tracker. Set <code>APP_PASSWORD</code> in your env to change this.
        </p>
      </form>
    </main>
  );
}
