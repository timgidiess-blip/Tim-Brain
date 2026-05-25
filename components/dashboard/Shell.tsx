import type { ReactNode } from "react";

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: [
            "radial-gradient(ellipse 55% 35% at 15% 15%, oklch(35% 0.14 290 / 0.13) 0%, transparent 70%)",
            "radial-gradient(ellipse 45% 35% at 85% 80%, oklch(35% 0.14 160 / 0.11) 0%, transparent 70%)",
            "radial-gradient(ellipse 40% 40% at 50% 45%, oklch(28% 0.08 255 / 0.09) 0%, transparent 70%)",
          ].join(", "),
        }}
      />
      <div className="relative z-10 max-w-[1440px] mx-auto px-5 pb-7">
        {children}
      </div>
    </>
  );
}
