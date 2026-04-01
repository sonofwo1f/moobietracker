import { getDashboardData } from "@/lib/data";
import { TrackerApp } from "@/components/TrackerApp";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getDashboardData();
  return <TrackerApp initialData={data} />;
}
