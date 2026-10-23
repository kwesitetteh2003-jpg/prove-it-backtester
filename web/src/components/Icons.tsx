import type { SVGProps } from "react";

const base = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;
type P = SVGProps<SVGSVGElement>;

export const IconCheck = (p: P) => <svg {...base} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const IconWarn = (p: P) => <svg {...base} {...p}><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17.2v.1" /></svg>;
export const IconX = (p: P) => <svg {...base} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IconInfo = (p: P) => <svg {...base} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8v.1" /></svg>;
export const IconArrow = (p: P) => <svg {...base} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const IconPlay = (p: P) => <svg {...base} {...p}><path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" /></svg>;
export const IconShield = (p: P) => <svg {...base} {...p}><path d="M12 3l7 3v5.5c0 4.2-2.8 7.8-7 9.5-4.2-1.7-7-5.3-7-9.5V6z" /><path d="M9 12l2.2 2.2L15.5 10" /></svg>;
export const IconUpload = (p: P) => <svg {...base} {...p}><path d="M12 16V5M7.5 9.5L12 5l4.5 4.5M5 19h14" /></svg>;
export const IconTerminal = (p: P) => <svg {...base} {...p}><rect x="3" y="4.5" width="18" height="15" rx="2" /><path d="M7 10l3 2.5L7 15M12.5 15H17" /></svg>;
export const IconFlask = (p: P) => <svg {...base} {...p}><path d="M9.5 4h5M10.5 4v5.5L5 19a1 1 0 00.9 1.5h12.2A1 1 0 0019 19l-5.5-9.5V4" /><path d="M8 15h8" /></svg>;
export const IconSpark = (p: P) => <svg {...base} {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" /></svg>;
export const IconChevron = (p: P) => <svg {...base} {...p}><path d="M6 9l6 6 6-6" /></svg>;

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path d="M5 5v22M27 5v22" stroke="#c6ff3d" strokeWidth="2" opacity=".55" />
      <path d="M8 22l5-6 4 3 7-10" stroke="#c6ff3d" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
