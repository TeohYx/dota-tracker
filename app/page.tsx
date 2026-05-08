import { redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth";
import Dashboard from "@/components/Dashboard";

export default async function Page() {
  const principal = await getPrincipal();
  if (!principal) redirect("/login");

  if (principal.kind === "guest") {
    const guestAccountId = Number(process.env.DEFAULT_ACCOUNT_ID ?? "403281874");
    return <Dashboard kind="guest" accountId={guestAccountId} />;
  }

  return <Dashboard kind="user" user={principal.user} />;
}
