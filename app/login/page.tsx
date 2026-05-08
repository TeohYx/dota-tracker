import { redirect } from "next/navigation";
import {
  isAuthenticated,
  setUserSessionCookie,
  setGuestCookie,
  hashPassword,
  verifyPassword
} from "@/lib/auth";
import { createUser, getUserByEmail } from "@/lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function signInAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!EMAIL_RE.test(email) || password.length < 1) {
    redirect("/login?mode=signin&error=invalid");
  }
  const user = await getUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    redirect("/login?mode=signin&error=bad");
  }
  setUserSessionCookie(user.id);
  redirect("/");
}

async function signUpAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!EMAIL_RE.test(email)) {
    redirect("/login?mode=signup&error=email");
  }
  if (password.length < 8) {
    redirect("/login?mode=signup&error=short");
  }
  const existing = await getUserByEmail(email);
  if (existing) {
    redirect("/login?mode=signup&error=taken");
  }
  const password_hash = await hashPassword(password);
  const user = await createUser({ email, password_hash });
  setUserSessionCookie(user.id);
  redirect("/");
}

async function guestAction() {
  "use server";
  setGuestCookie();
  redirect("/");
}

const ERROR_TEXT: Record<string, string> = {
  invalid: "Enter a valid email and password.",
  bad: "Wrong email or password.",
  email: "That doesn't look like a valid email.",
  short: "Password must be at least 8 characters.",
  taken: "An account with that email already exists."
};

export default function LoginPage({
  searchParams
}: {
  searchParams: { mode?: string; error?: string };
}) {
  if (isAuthenticated()) redirect("/");
  const mode = searchParams.mode === "signup" ? "signup" : "signin";
  const error = searchParams.error ? ERROR_TEXT[searchParams.error] ?? null : null;

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="card w-full max-w-sm flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-bold">Dota 2 MMR Tracker</h1>
          <p className="text-xs text-muted">
            {mode === "signup"
              ? "Create an account to start tracking your goal."
              : "Sign in to your tracker, or peek as a guest."}
          </p>
        </div>

        <div className="flex rounded-md border border-border bg-panel2 p-1 text-xs">
          <a
            href="/login?mode=signin"
            className={`flex-1 rounded px-3 py-1.5 text-center transition ${
              mode === "signin" ? "bg-accent text-white" : "text-muted hover:text-text"
            }`}
          >
            Sign in
          </a>
          <a
            href="/login?mode=signup"
            className={`flex-1 rounded px-3 py-1.5 text-center transition ${
              mode === "signup" ? "bg-accent text-white" : "text-muted hover:text-text"
            }`}
          >
            Create account
          </a>
        </div>

        {mode === "signin" ? (
          <form action={signInAction} className="flex flex-col gap-3">
            <label className="block">
              <span className="label">Email</span>
              <input
                name="email"
                type="email"
                className="input"
                autoComplete="email"
                autoFocus
                required
              />
            </label>
            <label className="block">
              <span className="label">Password</span>
              <input
                name="password"
                type="password"
                className="input"
                autoComplete="current-password"
                required
              />
            </label>
            {error && (
              <div className="rounded-md border border-lose/40 bg-lose/10 px-3 py-2 text-xs text-lose">
                {error}
              </div>
            )}
            <button className="btn" type="submit">Sign in</button>
          </form>
        ) : (
          <form action={signUpAction} className="flex flex-col gap-3">
            <label className="block">
              <span className="label">Email</span>
              <input
                name="email"
                type="email"
                className="input"
                autoComplete="email"
                autoFocus
                required
              />
            </label>
            <label className="block">
              <span className="label">Password</span>
              <input
                name="password"
                type="password"
                className="input"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <span className="mt-1 block text-[11px] text-muted">At least 8 characters.</span>
            </label>
            {error && (
              <div className="rounded-md border border-lose/40 bg-lose/10 px-3 py-2 text-xs text-lose">
                {error}
              </div>
            )}
            <button className="btn" type="submit">Create account</button>
          </form>
        )}

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
          Guests see a read-only view of the default account. Sign in to track your own MMR goal.
        </p>
      </div>
    </main>
  );
}
