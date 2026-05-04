import Dashboard from "@/components/Dashboard";

export default function Page() {
  const defaultId = Number(process.env.DEFAULT_ACCOUNT_ID ?? "403281874");
  return <Dashboard initialAccountId={defaultId} />;
}
