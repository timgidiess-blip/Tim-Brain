import Shell      from "@/components/dashboard/Shell";
import TopRail    from "@/components/dashboard/TopRail";
import HealthPage from "@/components/health/HealthPage";

export default function Health() {
  return (
    <Shell>
      <TopRail />
      <HealthPage />
    </Shell>
  );
}
