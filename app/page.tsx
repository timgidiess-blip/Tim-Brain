import Shell from "@/components/dashboard/Shell";
import TopRail from "@/components/dashboard/TopRail";
import OperatorCard from "@/components/dashboard/OperatorCard";
import FinancePulseCard from "@/components/dashboard/FinancePulseCard";
import KeyBlockersCard from "@/components/dashboard/KeyBlockersCard";
import SessionCard from "@/components/dashboard/SessionCard";
import HabitTrackerCard from "@/components/dashboard/HabitTrackerCard";
import PrioritiesCard from "@/components/dashboard/PrioritiesCard";
import NutritionCard from "@/components/dashboard/NutritionCard";
import CalendarCard from "@/components/dashboard/CalendarCard";
import GoalsCard from "@/components/dashboard/GoalsCard";
import CaptureBox from "@/components/dashboard/CaptureBox";

export default function Home() {
  return (
    <Shell>
      <TopRail />
      <div
        className="grid gap-[14px] items-start"
        style={{ gridTemplateColumns: "270px 1fr 270px" }}
      >
        {/* Left column */}
        <div className="flex flex-col gap-[14px]">
          <OperatorCard />
          <FinancePulseCard />
          <KeyBlockersCard />
          <GoalsCard />
        </div>

        {/* Centre column */}
        <div className="flex flex-col gap-[14px]">
          <SessionCard />
          <HabitTrackerCard />
          <PrioritiesCard />
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-[14px]">
          <NutritionCard />
          <CalendarCard />
        </div>
      </div>

      <CaptureBox />
    </Shell>
  );
}
