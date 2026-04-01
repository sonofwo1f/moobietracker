import { getDashboardData } from "@/lib/data";
import { ClubShell } from "@/components/ClubShell";

export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await getDashboardData();
  return <ClubShell initialData={data} view="history" />;
}
