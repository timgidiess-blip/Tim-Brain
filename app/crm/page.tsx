import Shell   from "@/components/dashboard/Shell";
import TopRail  from "@/components/dashboard/TopRail";
import CRMPage  from "@/components/crm/CRMPage";

export default function CRM() {
  return (
    <Shell>
      <TopRail />
      <div className="flex flex-col" style={{ height: "calc(100vh - 90px)" }}>
        <CRMPage />
      </div>
    </Shell>
  );
}
