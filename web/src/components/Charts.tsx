import { motion, useReducedMotion } from "framer-motion";
import { useId, useMemo, useState, type PointerEvent } from "react";
import { useSize } from "../lib/hooks";
import { compact, date, money, pct } from "../lib/format";
import type { Report } from "../lib/api";
import { ease } from "./ui";

const M = { l: 54, r: 14, t: 14, b: 26 };

function niceTicks(lo: number, hi: number, n = 4) {
  const span = hi - lo || 1;
  const raw = span / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(v);
  return out;
}

function pathOf(xs: number[], ys: number[], idx: number[]) {
  return idx.map((i, k) => `${k ? "L" : "M"}${xs[i]!.toFixed(1)},${ys[i]!.toFixed(1)}`).join("");
}

function sampleIdx(n: number, max: number) {
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  const stride = (n - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => Math.round(i * stride));
}

function XAxis({ times, x, h, w }: { times: string[]; x: (i: number) => number; h: number; w: number }) {
  const ticks = useMemo(() => {
    const out: { i: number; label: string }[] = [];
    let last = "";
    times.forEach((t, i) => { const y = t.slice(0, 4); if (y !== last) { last = y; out.push({ i, label: y }); } });
    const every = Math.ceil(out.length / Math.max(2, Math.floor(w / 80)));
    return out.filter((_, k) => k % every === 0);
  }, [times, w]);
  return <g>{ticks.map((t) => <text key={t.i} x={x(t.i)} y={h - 8} textAnchor="middle" className="fill-faint font-mono text-[10px]">{t.label}</text>)}</g>;
}

interface Shared { report: Report; hover: number | null; setHover: (i: number | null) => void }

export function EquityChart({ report, hover, setHover }: Shared) {
  const [ref, { w }] = useSize<HTMLDivElement>();
  const reduce = useReducedMotion();
  const [log, setLog] = useState(() => Math.max(...report.equity, ...report.benchmark) / Math.max(1, Math.min(...report.equity, ...report.benchmark)) > 8);
  const [showTrades, setShowTrades] = useState(true);
  const [showBH, setShowBH] = useState(true);
  const gid = useId();
  const H = 330;
  const n = report.equity.length;
  const iw = Math.max(10, w - M.l - M.r), ih = H - M.t - M.b;

  const g = useMemo(() => {
    const f = log ? Math.log : (v: number) => v;
    const all = [...report.equity, ...(showBH ? report.benchmark : [])].map(f);
    let lo = Math.min(...all), hi = Math.max(...all);
    const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
    const x = (i: number) => M.l + (i / (n - 1)) * iw;
    const y = (v: number) => M.t + (1 - (f(v) - lo) / (hi - lo)) * ih;
    const ticks = log
      ? (() => { const a = Math.exp(lo), b = Math.exp(hi); const r = Math.pow(b / a, 1 / 4); return [0, 1, 2, 3, 4].map((k) => { const v = a * r ** k; const m = 10 ** Math.floor(Math.log10(v)); return Math.round(v / m * 2) / 2 * m; }); })()
      : niceTicks(Math.min(...report.equity, ...(showBH ? report.benchmark : [])), Math.max(...report.equity, ...(showBH ? report.benchmark : [])), 4);
    const xs = report.equity.map((_, i) => x(i));
    const idx = sampleIdx(n, 900);
    return { x, y, ticks, eqPath: pathOf(xs, report.equity.map(y), idx), bhPath: pathOf(xs, report.benchmark.map(y), idx), xs, idx };
  }, [report, log, showBH, n, iw, ih]);

  const baseY = M.t + ih;
  const area = `${g.eqPath}L${g.x(n - 1)},${baseY}L${g.x(0)},${baseY}Z`;
  const split = report.analysis.split;

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const hv = hover;
  const tipLeft = hv !== null ? Math.min(Math.max(g.x(hv), 100), w - 100) : 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-fg"><i className="h-0.5 w-5 bg-phos" />Strategy</span>
          <button onClick={() => setShowBH(!showBH)} className={`flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-opacity ${showBH ? "text-fg" : "text-faint line-through"}`}><i className="h-0.5 w-5 bg-ice" />Buy &amp; hold</button>
          <button onClick={() => setShowTrades(!showTrades)} className={`flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-opacity ${showTrades ? "text-fg" : "text-faint line-through"}`}><i className="h-0 w-0 border-x-[4px] border-b-[7px] border-x-transparent border-b-phos" />Trades</button>
        </div>
        <div className="flex rounded-md border border-line p-0.5 font-mono text-[11px] uppercase tracking-[0.12em]">
          {[["Linear", false], ["Log", true]].map(([l, v]) => (
            <button key={String(l)} onClick={() => setLog(v as boolean)} className={`rounded px-2.5 py-1 transition-colors ${log === v ? "bg-white/10 text-fg" : "text-dim hover:text-fg"}`}>{l as string}</button>
          ))}
        </div>
      </div>
      <div ref={ref} className="relative select-none" style={{ height: H }}>
        {w > 0 && (
          <svg width={w} height={H} onPointerLeave={() => setHover(null)} className="overflow-visible">
            <defs>
              <linearGradient id={`${gid}a`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c6ff3d" stopOpacity=".22" /><stop offset="1" stopColor="#c6ff3d" stopOpacity="0" /></linearGradient>
              <filter id={`${gid}g`} x="-5%" y="-20%" width="110%" height="140%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            {g.ticks.map((t) => (
              <g key={t}>
                <line x1={M.l} x2={w - M.r} y1={g.y(t)} y2={g.y(t)} stroke="rgba(255,255,255,.06)" />
                <text x={M.l - 8} y={g.y(t) + 3.5} textAnchor="end" className="fill-faint font-mono text-[10px]">{compact(t)}</text>
              </g>
            ))}
            <XAxis times={report.times} x={g.x} h={H} w={w} />
            {split && (
              <motion.g initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6, duration: 0.8 }}>
                <rect x={g.x(split.splitIdx)} y={M.t} width={g.x(n - 1) - g.x(split.splitIdx)} height={ih} fill="rgba(255,255,255,.025)" />
                <line x1={g.x(split.splitIdx)} x2={g.x(split.splitIdx)} y1={M.t} y2={baseY} stroke="rgba(255,255,255,.28)" strokeDasharray="3 4" />
                <text x={g.x(split.splitIdx) + 8} y={M.t + 12} className="fill-dim font-mono text-[10px] uppercase tracking-widest">Out-of-sample</text>
              </motion.g>
            )}
            <motion.path d={area} fill={`url(#${gid}a)`} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1, duration: 1.2 }} key={`a${log}`} />
            {showBH && <motion.path d={g.bhPath} fill="none" stroke="#6fe7ff" strokeWidth={1.3} strokeOpacity={0.85} strokeLinejoin="round" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.8, ease }} key={`b${log}`} />}
            <motion.path d={g.eqPath} fill="none" stroke="#c6ff3d" strokeWidth={1.9} strokeLinejoin="round" filter={`url(#${gid}g)`} initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.8, ease }} key={`e${log}`} />
            {showTrades && report.trades.length <= 150 && (
              <motion.g initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.7, duration: 0.6 }}>
                {report.trades.map((t, i) => (
                  <g key={i}>
                    <path d={`M${g.x(t.entryIdx)},${g.y(report.equity[t.entryIdx]!) - 9}l-3.5,6.5h7z`} fill="#c6ff3d" opacity=".9" />
                    <circle cx={g.x(t.exitIdx)} cy={g.y(report.equity[t.exitIdx]!)} r={2.6} fill={t.pnl >= 0 ? "#05060a" : "#ff4d6a"} stroke={t.pnl >= 0 ? "#c6ff3d" : "#ff4d6a"} strokeWidth={1.2} />
                  </g>
                ))}
              </motion.g>
            )}
            {hv !== null && (
              <g pointerEvents="none">
                <line x1={g.x(hv)} x2={g.x(hv)} y1={M.t} y2={baseY} stroke="rgba(255,255,255,.35)" />
                <circle cx={g.x(hv)} cy={g.y(report.equity[hv]!)} r={4} fill="#c6ff3d" stroke="#05060a" strokeWidth={2} />
                {showBH && <circle cx={g.x(hv)} cy={g.y(report.benchmark[hv]!)} r={3.5} fill="#6fe7ff" stroke="#05060a" strokeWidth={2} />}
              </g>
            )}
            <rect x={M.l} y={M.t} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} style={{ touchAction: "pan-y" }} />
          </svg>
        )}
        {hv !== null && w > 0 && (
          <div className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-md border border-line2 bg-bg/90 px-3 py-2 font-mono text-[11px] shadow-2xl backdrop-blur" style={{ left: tipLeft }}>
            <div className="text-dim">{date(report.times[hv]!)}</div>
            <div className="mt-1 flex items-center gap-2 text-fg"><i className="h-1.5 w-1.5 rounded-full bg-phos" />{money(report.equity[hv]!)}</div>
            <div className="flex items-center gap-2 text-fg"><i className="h-1.5 w-1.5 rounded-full bg-ice" />{money(report.benchmark[hv]!)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function DrawdownChart({ report, hover, setHover }: Shared) {
  const [ref, { w }] = useSize<HTMLDivElement>();
  const reduce = useReducedMotion();
  const gid = useId();
  const H = 140;
  const n = report.drawdown.length;
  const iw = Math.max(10, w - M.l - M.r), ih = H - M.t - M.b;
  const g = useMemo(() => {
    const lo = Math.min(-1, ...report.drawdown, ...report.benchmarkDrawdown) * 1.05;
    const x = (i: number) => M.l + (i / (n - 1)) * iw;
    const y = (v: number) => M.t + (v / lo) * ih;
    const xs = report.drawdown.map((_, i) => x(i));
    const idx = sampleIdx(n, 900);
    const line = pathOf(xs, report.drawdown.map(y), idx);
    return { x, y, lo, line, bh: pathOf(xs, report.benchmarkDrawdown.map(y), idx), ticks: [0, lo / 2, lo].map((v) => Math.round(v / 5) * 5) };
  }, [report, n, iw, ih]);
  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
  };
  return (
    <div>
      <div className="mb-2 flex items-center gap-5 font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="flex items-center gap-2 text-fg"><i className="h-1.5 w-5 bg-loss/70" />Strategy drawdown</span>
        <span className="flex items-center gap-2 text-dim"><i className="h-0.5 w-5 bg-ice/60" />Buy &amp; hold</span>
      </div>
      <div ref={ref} style={{ height: H }}>
        {w > 0 && (
          <svg width={w} height={H} onPointerLeave={() => setHover(null)}>
            <defs><linearGradient id={`${gid}d`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff4d6a" stopOpacity=".05" /><stop offset="1" stopColor="#ff4d6a" stopOpacity=".38" /></linearGradient></defs>
            {g.ticks.map((t) => (
              <g key={t}><line x1={M.l} x2={w - M.r} y1={g.y(t)} y2={g.y(t)} stroke="rgba(255,255,255,.06)" /><text x={M.l - 8} y={g.y(t) + 3.5} textAnchor="end" className="fill-faint font-mono text-[10px]">{t}%</text></g>
            ))}
            <XAxis times={report.times} x={g.x} h={H} w={w} />
            <motion.path d={g.bh} fill="none" stroke="#6fe7ff" strokeOpacity={0.45} strokeWidth={1} initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.8, ease }} />
            <motion.path d={`${g.line}L${g.x(n - 1)},${g.y(0)}L${g.x(0)},${g.y(0)}Z`} fill={`url(#${gid}d)`} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 1 }} />
            <motion.path d={g.line} fill="none" stroke="#ff4d6a" strokeWidth={1.4} initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.8, ease }} />
            {hover !== null && (
              <g pointerEvents="none">
                <line x1={g.x(hover)} x2={g.x(hover)} y1={M.t} y2={M.t + ih} stroke="rgba(255,255,255,.35)" />
                <circle cx={g.x(hover)} cy={g.y(report.drawdown[hover]!)} r={3.5} fill="#ff4d6a" stroke="#05060a" strokeWidth={2} />
                <text x={Math.min(g.x(hover) + 8, w - 60)} y={M.t + 10} className="fill-fg font-mono text-[10px]">{pct(report.drawdown[hover]!, 1, false)}</text>
              </g>
            )}
            <rect x={M.l} y={M.t} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} style={{ touchAction: "pan-y" }} />
          </svg>
        )}
      </div>
    </div>
  );
}
