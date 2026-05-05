import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import Dashboard from "@/components/Dashboard";

export default function Page() {
  if (!isAuthenticated()) redirect("/login");
  const accountId = Number(process.env.DEFAULT_ACCOUNT_ID ?? "403281874");
  return <Dashboard accountId={accountId} />;
}
