import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import Dashboard from "@/components/Dashboard";

export default function Page() {
  const role = getRole();
  if (!role) redirect("/login");
  const accountId = Number(process.env.DEFAULT_ACCOUNT_ID ?? "403281874");
  return <Dashboard accountId={accountId} role={role} />;
}
