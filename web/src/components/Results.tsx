import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import type { Check, Report, RunOut, SandboxMeta } from "../lib/api";
import { date, money, pct } from "../lib/format";
import { DrawdownChart, EquityChart } from "./Charts";
import { IconCheck, IconChevron, IconInfo, IconWarn, IconX } from "./Icons";
import { Counter, ease } from "./ui";

export function Panel({ title, aside, children, className = "", delay = 0 }: { title: string; aside?: ReactNode; children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay, ease }} className={`panel p-5 sm:p-6 ${className}`}>
      <div className="mb-5 flex items-center justify-between gap-4"><h3 className="label text-fg">{title}</h3>{aside && <div className="label">{aside}</div>}</div>
      {children}
    </motion.section>
  );
}

const VERDICT = {
  not_credible: { label: "Not credible", color: "text-loss", ring: "border-loss/40", glow: "from-loss/15", dot: "bg-loss" },
  inconclusive: { label: "Inconclusive", color: "text-amber", ring: "border-amber/40", glow: "from-amber/15", dot: "bg-amber" },
  holds_up: { label: "Holds up (so far)", color: "text-phos", ring: "border-phos/40", glow: "from-phos/15", dot: "bg-phos" },
} as const;

export function VerdictBanner({ report }: { report: Report }) {
  const v = report.analysis.verdict;
  const s = VERDICT[v.label];
  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, ease }} className={`brackets relative overflow-hidden rounded-xl border ${s.ring} bg-gradient-to-br ${s.glow} to-transparent p-6 sm:p-8`}>
      <div className="label flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />Verdict</div>
      <motion.h2 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.8, ease }} className={`mt-3 text-4xl font-semibold tracking-[-0.035em] sm:text-6xl ${s.color}`}>{s.label}</motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35, duration: 0.8 }} className="mt-3 max-w-2xl text-balance text-[16px] leading-relaxed text-fg/85">{v.headline}</motion.p>
      <ul className="mt-5 flex flex-wrap gap-2">
        {v.reasons.map((r, i) => (
          <motion.li key={r} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.07, duration: 0.5, ease }} className="rounded-full border border-line2 bg-black/30 px-3 py-1 text-[12px] text-dim">{r}</motion.li>
        ))}
      </ul>
    </motion.div>
  );
}

export function MetricGrid({ report }: { report: Report }) {
  const m = report.metrics, b = report.benchmarkMetrics;
  const tiles: { label: string; value: number; dec: number; prefix?: string; suffix?: string; color?: string; sub: string }[] = [
    { label: "Total return", value: m.totalReturnPct, dec: 1, suffix: "%", prefix: m.totalReturnPct > 0 ? "+" : "", color: m.totalReturnPct >= 0 ? "text-phos" : "text-loss", sub: `Buy & hold ${pct(b.totalReturnPct)}` },
    { label: "Max drawdown", value: m.maxDrawdownPct, dec: 1, suffix: "%", color: "text-loss", sub: `Buy & hold ${pct(b.maxDrawdownPct, 1, false)}` },
    { label: "Win rate", value: m.winRatePct, dec: 0, suffix: "%", sub: `${m.trades} trades` },
    { label: "Sharpe", value: m.sharpe, dec: 2, sub: `Buy & hold ${b.sharpe.toFixed(2)}` },
    { label: "CAGR", value: m.cagrPct, dec: 1, suffix: "%", prefix: m.cagrPct > 0 ? "+" : "", sub: `Buy & hold ${pct(b.cagrPct)}` },
    { label: "Profit factor", value: Number.isFinite(m.profitFactor) ? m.profitFactor : 0, dec: 2, sub: Number.isFinite(m.profitFactor) ? "Gross win / gross loss" : "No losing trades" },
    { label: "Time in market", value: m.exposurePct, dec: 0, suffix: "%", sub: `Avg hold ${m.avgBarsHeld.toFixed(0)} bars` },
    { label: "Fees & slippage", value: m.feesPaid, dec: 0, prefix: "$", sub: `Final ${money(m.finalEquity)}` },
  ];
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
      {tiles.map((t, i) => (
        <motion.div key={t.label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 + i * 0.06, duration: 0.6 }} className="group bg-bg p-4 transition-colors hover:bg-bg2 sm:p-5">
          <div className="label">{t.label}</div>
          <div className={`mt-2 text-3xl font-semibold tracking-tight sm:text-4xl ${t.color ?? "text-fg"}`}><Counter value={t.value} decimals={t.dec} prefix={t.prefix} suffix={t.suffix} delay={0.15 + i * 0.06} /></div>
          <div className="mt-1.5 truncate text-[12px] text-faint">{t.sub}</div>
        </motion.div>
      ))}
    </div>
  );
}

const STATUS = {
  pass: { icon: IconCheck, color: "text-phos", bg: "bg-phos/10", bd: "border-phos/20", tag: "Pass" },
  info: { icon: IconInfo, color: "text-ice", bg: "bg-ice/10", bd: "border-ice/20", tag: "Note" },
  warn: { icon: IconWarn, color: "text-amber", bg: "bg-amber/10", bd: "border-amber/25", tag: "Warning" },
  fail: { icon: IconX, color: "text-loss", bg: "bg-loss/10", bd: "border-loss/30", tag: "Fail" },
} as const;

export function Checks({ checks }: { checks: Check[] }) {
  const order = { fail: 0, warn: 1, info: 2, pass: 3 } as const;
  const sorted = [...checks].sort((a, b) => order[a.status] - order[b.status]);
  const counts = (["fail", "warn", "info", "pass"] as const).map((s) => [s, checks.filter((c) => c.status === s).length] as const).filter(([, n]) => n);
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {counts.map(([s, n]) => <span key={s} className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider ${STATUS[s].bd} ${STATUS[s].bg} ${STATUS[s].color}`}>{n} {STATUS[s].tag}</span>)}
      </div>
      <ul className="space-y-2">
        {sorted.map((c, i) => {
          const S = STATUS[c.status];
          return (
            <motion.li key={c.id} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06, duration: 0.6, ease }} className={`flex gap-3.5 rounded-lg border ${S.bd} ${S.bg} p-4`}>
              <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border ${S.bd} ${S.color}`}><S.icon className="h-3.5 w-3.5" /></span>
              <div className="min-w-0"><h4 className="text-[15px] font-medium tracking-tight">{c.title}</h4><p className="mt-1 text-[13px] leading-relaxed text-dim">{c.detail}</p></div>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

function Range({ lo, hi, mid, base, color = "bg-phos" }: { lo: number; hi: number; mid?: number; base?: number; color?: string }) {
  const min = Math.min(lo, base ?? lo, 0), max = Math.max(hi, base ?? hi, 0);
  const p = (v: number) => ((v - min) / (max - min || 1)) * 100;
  return (
    <div className="relative mt-3 h-6">
      <div className="absolute inset-x-0 top-1/2 h-px bg-line2" />
      <div className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-white/40" style={{ left: `${p(0)}%` }} />
      <motion.div className={`absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full ${color} opacity-70`} initial={{ width: 0, left: `${p(lo)}%` }} animate={{ width: `${p(hi) - p(lo)}%`, left: `${p(lo)}%` }} transition={{ duration: 1.1, delay: 0.5, ease }} />
      {mid !== undefined && <motion.i className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-white" initial={{ opacity: 0 }} animate={{ opacity: 1, left: `${p(mid)}%` }} transition={{ delay: 1, duration: 0.6 }} />}
      {base !== undefined && <motion.i className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg bg-amber" initial={{ opacity: 0 }} animate={{ opacity: 1, left: `${p(base)}%` }} transition={{ delay: 1.2, duration: 0.6 }} />}
    </div>
  );
}

export function StressTests({ report }: { report: Report }) {
  const a = report.analysis, m = report.metrics;
  const cards: ReactNode[] = [];
  if (a.split) {
    const { inSample: i, outSample: o } = a.split;
    cards.push(
      <div key="oos"><div className="label">First 70% vs last 30%</div>
        <div className="mt-3 grid grid-cols-2 gap-3">{[["Earlier", i], ["Later", o]].map(([l, v]) => { const s = v as typeof i; return (
          <div key={l as string}><div className="text-[11px] text-faint">{l as string}</div><div className={`tnum text-2xl font-semibold ${s.returnPct >= 0 ? "text-phos" : "text-loss"}`}>{pct(s.returnPct, 0)}</div><div className="tnum text-[11px] text-faint">hold {pct(s.benchmarkPct, 0)}</div></div>); })}</div>
        <p className="mt-3 text-[12px] leading-snug text-faint">Same fixed rules, split at {date(a.split.splitTime)}. Not a walk-forward test.</p></div>,
    );
  }
  if (a.sensitivity) {
    const s = a.sensitivity;
    cards.push(
      <div key="sens"><div className="label">Parameter nudges ({s.runs} runs)</div>
        <div className="mt-3 flex items-baseline gap-2"><span className="tnum text-2xl font-semibold">{(s.positiveShare * 100).toFixed(0)}%</span><span className="text-[12px] text-faint">profitable nearby</span></div>
        <Range lo={s.worstReturnPct} hi={s.bestReturnPct} mid={s.medianReturnPct} base={m.totalReturnPct} />
        <p className="mt-2 text-[12px] leading-snug text-faint">Range {pct(s.worstReturnPct, 0)} to {pct(s.bestReturnPct, 0)}. Amber dot is your setting.</p></div>,
    );
  }
  if (a.costStress) {
    const c = a.costStress;
    cards.push(
      <div key="cost"><div className="label">{c.multiple}x costs</div>
        <div className="mt-3 flex items-center gap-3"><span className="tnum text-2xl font-semibold text-fg/60">{pct(m.totalReturnPct, 0)}</span><span className="text-faint">to</span><span className={`tnum text-2xl font-semibold ${c.returnPct >= 0 ? "text-phos" : "text-loss"}`}>{pct(c.returnPct, 0)}</span></div>
        <p className="mt-3 text-[12px] leading-snug text-faint">Return after doubling fees and slippage. Real fills are rarely kinder than assumed.</p></div>,
    );
  }
  if (a.bootstrap) {
    const b = a.bootstrap;
    cards.push(
      <div key="bs"><div className="label">Bootstrap ({b.samples} reshuffles)</div>
        <div className="mt-3 flex items-baseline gap-2"><span className="tnum text-2xl font-semibold">{pct(b.returnP5, 0)}</span><span className="text-faint">to</span><span className="tnum text-2xl font-semibold">{pct(b.returnP95, 0)}</span></div>
        <Range lo={b.returnP5} hi={b.returnP95} mid={b.returnP50} color="bg-ice" />
        <p className="mt-2 text-[12px] leading-snug text-faint">5th to 95th percentile of trade-order outcomes. Typical worst drawdown {pct(b.maxDrawdownP50, 0, false)}, bad luck {pct(b.maxDrawdownP95, 0, false)}.</p></div>,
    );
  }
  if (!cards.length) return null;
  return <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">{cards.map((c, i) => <div key={i} className="bg-bg p-5">{c}</div>)}</div>;
}

const px = (v: number) => (v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(2));
const reasonLabel = { signal: "Signal", stop_loss: "Stop", take_profit: "Target", end_of_data: "End" } as const;
export function Trades({ report }: { report: Report }) {
  const [all, setAll] = useState(false);
  const rows = [...report.trades].reverse();
  const shown = all ? rows : rows.slice(0, 8);
  if (!rows.length) return <p className="text-sm text-dim">No trades were taken on this data.</p>;
  return (
    <div>
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[460px] text-left font-mono text-[12px]">
          <thead><tr className="text-faint">{["Entry", "Exit", "Price in / out", "Return", "Why"].map((h) => <th key={h} className="px-2 pb-2 font-normal uppercase tracking-wider">{h}</th>)}</tr></thead>
          <tbody>
            <AnimatePresence initial>
              {shown.map((t, i) => (
                <motion.tr key={t.entryIdx} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 12) * 0.03 }} className="border-t border-line text-dim">
                  <td className="px-2 py-2">{date(t.entryTime)}</td><td className="px-2 py-2">{date(t.exitTime)}</td>
                  <td className="tnum whitespace-nowrap px-2 py-2">{px(t.entryPrice)} <span className="text-faint">/</span> {px(t.exitPrice)}</td>
                  <td className={`tnum px-2 py-2 ${t.retPct >= 0 ? "text-phos" : "text-loss"}`}>{pct(t.retPct, 1)}</td><td className="px-2 py-2">{reasonLabel[t.reason]}</td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
      {rows.length > 8 && <button onClick={() => setAll(!all)} className="label mt-3 inline-flex items-center gap-2 hover:text-fg">{all ? "Show fewer" : `Show all ${rows.length}`}<IconChevron className={`h-3.5 w-3.5 transition-transform ${all ? "rotate-180" : ""}`} /></button>}
    </div>
  );
}

export function SandboxLog({ sandbox }: { sandbox: SandboxMeta }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? sandbox.events.length : 0);
  useEffect(() => {
    if (reduce) { setN(sandbox.events.length); return; }
    setN(0);
    const id = setInterval(() => setN((x) => { if (x >= sandbox.events.length) { clearInterval(id); return x; } return x + 1; }), 160);
    return () => clearInterval(id);
  }, [sandbox, reduce]);
  const chips = [["fs", sandbox.isolation.filesystem], ["spawn", sandbox.isolation.processSpawn], ["env", sandbox.isolation.env], ["net", sandbox.isolation.network]] as const;
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {chips.map(([k, v]) => <span key={k} className="rounded border border-line px-2 py-1 font-mono text-[11px] text-dim"><span className="text-faint">{k}</span> <span className="text-fg">{v}</span></span>)}
      </div>
      <div className="rounded-lg border border-line bg-black/40 p-4 font-mono text-[12px] leading-relaxed">
        {sandbox.events.slice(0, n).map((e, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex gap-3">
            <span className="w-14 shrink-0 text-right text-faint tnum">{e.atMs}ms</span><span className="w-16 shrink-0 text-phos">{e.stage}</span><span className="text-dim">{e.message}</span>
          </motion.div>
        ))}
        {n < sandbox.events.length && <span className="inline-block h-3.5 w-1.5 animate-blink bg-phos" />}
      </div>
      <p className="mt-3 text-[12px] text-faint">{sandbox.node} · heap cap {sandbox.limits.heapMb} MB · wall cap {sandbox.limits.wallMs / 1000}s · ran in {sandbox.wallMs} ms</p>
    </div>
  );
}

export function ResultsView({ out }: { out: RunOut }) {
  const { report, sandbox } = out;
  const [hover, setHover] = useState<number | null>(null);
  const d = report.dataset;
  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label">Report</div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{report.spec.name}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-dim">
          <span className={`rounded border px-2 py-1 ${d.kind === "real" ? "border-phos/30 text-phos" : d.kind === "synthetic" ? "border-amber/40 text-amber" : "border-ice/30 text-ice"}`}>{d.kind}</span>
          <span>{d.name}</span><span className="text-faint">·</span><span>{date(d.from)} to {date(d.to)}</span>
        </div>
      </motion.div>
      {d.kind === "synthetic" && <div className="rounded-lg border border-amber/30 bg-amber/10 px-4 py-3 text-[13px] text-amber">Synthetic prices. Generated for demonstration; results say nothing about real markets.</div>}
      <VerdictBanner report={report} />
      <MetricGrid report={report} />
      <Panel title="Equity vs buy & hold" aside={`${money(report.spec.initialCapital)} start`} delay={0.2}>
        <EquityChart report={report} hover={hover} setHover={setHover} />
        <div className="mt-4 border-t border-line pt-4"><DrawdownChart report={report} hover={hover} setHover={setHover} /></div>
      </Panel>
      <Panel title="Honesty report" aside={`${report.analysis.checks.length} checks`} delay={0.25}>
        <div className="space-y-5"><StressTests report={report} /><Checks checks={report.analysis.checks} /></div>
      </Panel>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Panel title="Trades" aside={`${report.trades.length} total`} delay={0.3}><Trades report={report} /></Panel>
        <Panel title="Sandbox lifecycle" aside={`run ${sandbox.id}`} delay={0.35}><SandboxLog sandbox={sandbox} /></Panel>
      </div>
      <p className="px-1 pb-6 text-[12px] leading-relaxed text-faint">Backtests describe the past and are not advice. Long-only, daily bars, no leverage, fills at the next open with the fees and slippage shown. Nothing here connects to an exchange.</p>
    </div>
  );
}
