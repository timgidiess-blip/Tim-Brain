import type { CSSProperties, ReactNode } from "react";

type PanelStyle = CSSProperties & { "--accent"?: string };

export function CardHeader({ title, badge }: { title: string; badge: string }) {
  return (
    <div className="flex items-center justify-between mb-[13px]">
      <span
        className="text-[10px] font-bold tracking-[0.12em] uppercase"
        style={{ color: "oklch(42% 0.018 255)" }}
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
    background: "oklch(16% 0.028 255 / 0.55)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    borderTop: `2px solid ${accent}`,
    borderRight: "1px solid oklch(28% 0.030 255 / 0.55)",
    borderBottom: "1px solid oklch(28% 0.030 255 / 0.55)",
    borderLeft: "1px solid oklch(28% 0.030 255 / 0.55)",
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
