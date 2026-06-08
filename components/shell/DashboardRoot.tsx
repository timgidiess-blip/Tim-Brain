"use client";

import { useEffect, useState } from "react";
import type { SectionId } from "@/components/widgets/types";
import { SECTIONS } from "@/components/widgets/types";
import CaptureBox from "@/components/dashboard/CaptureBox";
import TopBar from "./TopBar";
import RollupStrip from "./RollupStrip";
import TabBar from "./TabBar";
import SectionView from "./SectionView";

const STORAGE_KEY = "tb:section";

function isSection(v: string | null): v is SectionId {
  return !!v && (SECTIONS as readonly string[]).includes(v);
}

export default function DashboardRoot() {
  // Default to Tasks — Tim's morning screen / #1 priority.
  const [section, setSection] = useState<SectionId>("tasks");

  // Restore the last-viewed tab after mount (avoids SSR/client mismatch).
  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (isSection(saved)) setSection(saved);
  }, []);

  function goTo(next: SectionId) {
    setSection(next);
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  }

  return (
    <>
      <TopBar />
      <RollupStrip active={section} onJump={goTo} />
      <TabBar active={section} onChange={goTo} />

      {/* key forces a remount per section so each grid loads its own layout */}
      <main className="pb-24 sm:pb-8">
        <SectionView key={section} section={section} />
      </main>

      <CaptureBox />
    </>
  );
}
