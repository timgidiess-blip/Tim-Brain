import type { CSSProperties, ReactNode } from "react";

type PanelStyle = CSSProperties & { "--accent"?: string };

export function CardHeader({ title, badge }: { title: string; badge: string }) {
  return (
    <div className="flex items-center justify-between mb-[13px]">
      <span
        className="text-[10px] font-bold tracking-[0.12em] uppercase"
        style={{ color: "var(--ink-2)" }}
      >
        {title}
      </span>
      <span
        className="text-[9px] font-bold px-[7px] py-[2px] rounded-[20px] font-mono tracking-[0.04em] border"
        style={{
          background: "color-mix(in oklch, var(--accent) 12%, transparent)",
          color: "var(--accent)",
          borderColor: "color-mix(in oklch, var(--accent) 28%, transparent)",
        }}
      >
        {badge}
      </span>
    </div>
  );
}

interface PanelProps {
  accent: string;
  children: ReactNode;
  className?: string;
}

export default function Panel({ accent, children, className = "" }: PanelProps) {
  const style: PanelStyle = {
    "--accent": accent,
    background: "var(--surface)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    borderTop: `2px solid ${accent}`,
    borderRight: "1px solid var(--border)",
    borderBottom: "1px solid var(--border)",
    borderLeft: "1px solid var(--border)",
    boxShadow: "0 1px 2px oklch(0% 0 0 / 0.04), 0 8px 24px -12px oklch(0% 0 0 / 0.18)",
  };

  return (
    <div
      className={`rounded-[14px] px-[18px] pt-[16px] pb-[18px] relative overflow-hidden ${className}`}
      style={style}
    >
      <div
        aria-hidden
        className="absolute top-0 inset-x-0 h-px pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${accent} 50%, transparent 100%)`,
          opacity: 0.42,
        }}
      />
      {children}
    </div>
  );
}
