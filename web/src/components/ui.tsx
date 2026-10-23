import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { useId, type ReactNode } from "react";
import { useCountUp } from "../lib/hooks";

export const ease = [0.16, 1, 0.3, 1] as const;

export function Reveal({ children, delay = 0, y = 22, className = "", as = "div" }: { children: ReactNode; delay?: number; y?: number; className?: string; as?: "div" | "li" | "section" }) {
  const M = motion[as] as typeof motion.div;
  return (
    <M className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.8, delay, ease }}>
      {children}
    </M>
  );
}

type BtnProps = HTMLMotionProps<"button"> & { variant?: "primary" | "ghost"; size?: "md" | "lg" };
export function Button({ variant = "primary", size = "md", className = "", children, ...rest }: BtnProps) {
  const pad = size === "lg" ? "h-13 px-7 text-[15px]" : "h-10 px-5 text-sm";
  const look = variant === "primary"
    ? "bg-phos text-black font-semibold hover:shadow-[0_0_0_1px_rgba(198,255,61,.9),0_8px_40px_-6px_rgba(198,255,61,.55)]"
    : "border border-line2 text-fg hover:border-white/40 hover:bg-white/[0.04]";
  return (
    <motion.button whileTap={{ scale: 0.97 }} transition={{ duration: 0.15 }} className={`group relative inline-flex items-center justify-center gap-2.5 overflow-hidden rounded-md tracking-tight transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50 ${pad} ${look} ${className}`} {...rest}>
      {variant === "primary" && <span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-0 group-hover:animate-sweep group-hover:opacity-100" />}
      <span className="relative inline-flex items-center gap-2.5">{children as ReactNode}</span>
    </motion.button>
  );
}

export function Counter({ value, decimals = 1, prefix = "", suffix = "", delay = 0, className = "" }: { value: number; decimals?: number; prefix?: string; suffix?: string; delay?: number; className?: string }) {
  const v = useCountUp(value, { delay });
  const shown = Number.isFinite(v) ? v : 0;
  return <span className={`tnum ${className}`}>{prefix}{shown.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
}

export function Segmented<T extends string>({ options, value, onChange, id }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; id: string }) {
  return (
    <div role="tablist" className="relative flex rounded-md border border-line bg-black/30 p-0.5">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={`relative z-10 flex-1 whitespace-nowrap px-3 py-2 text-[13px] font-medium transition-colors ${value === o.value ? "text-black" : "text-dim hover:text-fg"}`}>
          {value === o.value && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 -z-10 rounded-[5px] bg-phos" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({ label, value, min, max, step = 1, onChange, format, hint }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string; hint?: string }) {
  const id = useId();
  const p = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="label">{label}</label>
        <motion.span key={value} initial={{ y: -4, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.25, ease }} className="tnum font-mono text-[13px] text-fg">{format ? format(value) : value}</motion.span>
      </div>
      <input id={id} className="rng" type="range" min={min} max={max} step={step} value={value} style={{ ["--p" as string]: `${p}%` }} onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <p className="mt-0.5 text-xs text-faint">{hint}</p>}
    </div>
  );
}

export function Spark({ data, color = "#c6ff3d", height = 34, className = "" }: { data: number[]; color?: string; height?: number; className?: string }) {
  const id = useId();
  const reduce = useReducedMotion();
  const w = 160;
  const min = Math.min(...data), max = Math.max(...data);
  const pts = data.map((d, i) => [(i / (data.length - 1)) * w, height - 2 - ((d - min) / (max - min || 1)) * (height - 4)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className={className} width="100%" height={height} preserveAspectRatio="none" aria-hidden>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".28" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${line}L${w},${height}L0,${height}Z`} fill={`url(#${id})`} />
      <motion.path d={line} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease }} />
    </svg>
  );
}

export function SectionLabel({ n, children }: { n?: string; children: ReactNode }) {
  return (
    <div className="label flex items-center gap-3">
      {n && <span className="text-phos">{n}</span>}
      <span className="h-px w-8 bg-line2" />
      <span>{children}</span>
    </div>
  );
}
