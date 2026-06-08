"use client";

import type { SectionId } from "@/components/widgets/types";
import WidgetGrid from "@/components/widgets/WidgetGrid";

// Thin wrapper so the active section is a single mount point. Keyed by section
// in DashboardRoot so switching tabs remounts the grid (fresh layout load).
export default function SectionView({ section }: { section: SectionId }) {
  return <WidgetGrid section={section} />;
}
