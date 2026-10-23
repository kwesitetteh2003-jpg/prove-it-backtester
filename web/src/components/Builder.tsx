import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState, type ReactNode } from "react";
import type { Config, DatasetInfo, Rules } from "../lib/api";
import { date } from "../lib/format";
import { IconCheck, IconSpark, IconUpload } from "./Icons";
import { Button, Segmented, Slider, Spark, ease } from "./ui";

export type TemplateId = "ma_cross" | "rsi_reversion" | "breakout";
export type Params = Record<string, number | string>;
export interface Common { stopLossPct: number; takeProfitPct: number; feePct: number; slippagePct: number; positionSizePct: number }
export type DataChoice = { kind: "dataset"; id: string } | { kind: "csv"; name: string; text: string; rows: number };

export const EXAMPLES = [
  "Buy Bitcoin when the 20 day average crosses above the 50 day, sell when it crosses back, with a 10% stop loss",
  "Buy Ethereum when RSI(14) drops below 30 and sell when it rises above 55, stop loss 8%",
  "Buy Solana on a 30 day breakout and exit on a 10 day low",
];

function Step({ n, title, children, aside }: { n: string; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-b border-line p-5 last:border-b-0 sm:p-6">
      <div className="mb-4 flex items-center justify-between"><div className="label flex items-center gap-3"><span className="text-phos">{n}</span><span className="text-fg">{title}</span></div>{aside}</div>
      {children}
    </section>
  );
}

export function RulesCard({ rules, source, notes }: { rules: Rules; source: string; notes: string[] }) {
  const groups: [string, string[]][] = [["Entry", rules.entry], ["Exit", rules.exit], ["Risk", rules.risk], ["Costs", rules.costs]];
  return (
    <div className="mt-4 rounded-lg border border-line bg-black/30 p-4">
      <div className="mb-3 flex items-center justify-between"><span className="label flex items-center gap-2 text-phos"><IconSpark className="h-3.5 w-3.5" />Rules the engine will run</span><span className="label">{source}</span></div>
      <div className="space-y-2.5">
        {groups.filter(([, l]) => l.length).map(([g, lines]) => lines.map((l, i) => (
          <motion.div key={g + l} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05, duration: 0.45, ease }} className="flex gap-3 text-[13px] leading-snug">
            <span className="w-11 shrink-0 font-mono text-[10px] uppercase tracking-wider text-faint">{i === 0 ? g : ""}</span><span className="text-fg/90">{l}</span>
          </motion.div>
        )))}
      </div>
      {notes.length > 0 && <ul className="mt-3 space-y-1 border-t border-line pt-3 text-[12px] leading-snug text-amber/90">{notes.map((n) => <li key={n}>{n}</li>)}</ul>}
    </div>
  );
}

export function Builder(props: {
  config: Config; datasets: DatasetInfo[];
  prompt: string; setPrompt: (s: string) => void; onTranslate: () => void; translating: boolean; typing: boolean;
  onExample: (s: string) => void;
  mode: TemplateId | "custom"; setMode: (m: TemplateId) => void; params: Params; setParam: (k: string, v: number | string) => void;
  common: Common; setCommon: (c: Partial<Common>) => void;
  data: DataChoice; setData: (d: DataChoice) => void;
  rules: Rules | null; source: string; notes: string[];
  onRun: () => void; running: boolean; uploadError: string | null; setUploadError: (s: string | null) => void;
}) {
  const { config, datasets, mode, params, common } = props;
  const fileRef = useRef<HTMLInputElement>(null);
  const [showCosts, setShowCosts] = useState(false);
  const num = (k: string) => Number(params[k]);
  const T = (k: string, v: number) => props.setParam(k, v);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 2_400_000) { props.setUploadError("File is over 2.4 MB."); return; }
    const text = await f.text();
    const rows = Math.max(0, text.trim().split(/\r?\n/).length - 1);
    props.setUploadError(null);
    props.setData({ kind: "csv", name: f.name.replace(/\.csv$/i, ""), text, rows });
  };

  return (
    <div className="brackets panel overflow-hidden">
      <Step n="01" title="Describe">
        <div className="group relative rounded-lg border border-line bg-black/30 transition-colors focus-within:border-phos/60">
          <textarea value={props.prompt} onChange={(e) => props.setPrompt(e.target.value)} rows={4} maxLength={600} placeholder="Buy Bitcoin when the 20 day average crosses above the 50 day..."
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") props.onTranslate(); }}
            className="block w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-[15px] leading-relaxed text-fg outline-none placeholder:text-faint" aria-label="Describe your strategy" />
          <div className="flex items-center justify-between px-3 pb-3">
            <span className="font-mono text-[11px] text-faint">{props.typing ? "typing" : `${props.prompt.length}/600`}</span>
            <button onClick={props.onTranslate} disabled={props.translating || props.prompt.trim().length < 3} className="inline-flex h-8 items-center gap-2 rounded-md border border-line2 px-3 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors hover:border-phos hover:text-phos disabled:opacity-40">
              {props.translating ? <><span className="h-3 w-3 animate-spin rounded-full border border-phos border-t-transparent" />Translating</> : "Translate"}
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((e, i) => (
            <motion.button key={e} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }} onClick={() => props.onExample(e)} className="rounded-full border border-line px-3 py-1 text-[12px] text-dim transition-colors hover:border-phos/60 hover:text-fg">
              Try: {["Bitcoin trend", "Ethereum dip", "Solana breakout"][i]}
            </motion.button>
          ))}
        </div>
        {props.rules && <RulesCard rules={props.rules} source={props.source} notes={props.notes} />}
      </Step>

      <Step n="02" title="Tune" aside={mode === "custom" ? <span className="label text-ice">Custom rules</span> : undefined}>
        {mode === "custom" ? (
          <p className="text-[13px] leading-relaxed text-dim">The model wrote custom rules that do not fit a template. Describe the idea again to change them, or pick a template below.</p>
        ) : null}
        <div className={mode === "custom" ? "mt-4" : ""}>
          <Segmented id="tpl" value={(mode === "custom" ? "" : mode) as TemplateId} onChange={props.setMode}
            options={config.templates.map((t) => ({ value: t.id, label: { ma_cross: "MA cross", rsi_reversion: "RSI dip", breakout: "Breakout" }[t.id] }))} />
        </div>
        {mode !== "custom" && <p className="mt-3 text-[13px] text-dim">{config.templates.find((t) => t.id === mode)?.tagline}</p>}
        {mode !== "custom" && (
          <AnimatePresence mode="wait">
            <motion.div key={mode} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3, ease }} className="mt-5 space-y-5">
              {mode === "ma_cross" && (<>
                <div className="flex items-center justify-between"><span className="label">Average type</span>
                  <div className="flex rounded-md border border-line p-0.5 font-mono text-[11px] uppercase">{["sma", "ema"].map((k) => <button key={k} onClick={() => props.setParam("kind", k)} className={`rounded px-3 py-1 transition-colors ${params.kind === k ? "bg-white/10 text-fg" : "text-dim hover:text-fg"}`}>{k}</button>)}</div></div>
                <Slider label="Fast period" value={num("fast")} min={2} max={100} onChange={(v) => T("fast", v)} format={(v) => `${v} bars`} />
                <Slider label="Slow period" value={num("slow")} min={5} max={300} onChange={(v) => T("slow", v)} format={(v) => `${v} bars`} />
              </>)}
              {mode === "rsi_reversion" && (<>
                <Slider label="RSI period" value={num("period")} min={2} max={50} onChange={(v) => T("period", v)} />
                <Slider label="Buy below" value={num("oversold")} min={10} max={50} onChange={(v) => T("oversold", v)} />
                <Slider label="Sell above" value={num("overbought")} min={40} max={90} onChange={(v) => T("overbought", v)} />
              </>)}
              {mode === "breakout" && (<>
                <Slider label="Breakout lookback" value={num("lookback")} min={5} max={100} onChange={(v) => T("lookback", v)} format={(v) => `${v} bars`} />
                <Slider label="Exit on N-bar low" value={num("exitLookback")} min={3} max={100} onChange={(v) => T("exitLookback", v)} format={(v) => `${v} bars`} />
              </>)}
            </motion.div>
          </AnimatePresence>
        )}
        <div className="mt-5 space-y-5 border-t border-line pt-5">
          <Slider label="Stop loss" value={common.stopLossPct} min={0} max={40} onChange={(v) => props.setCommon({ stopLossPct: v })} format={(v) => (v ? `${v}%` : "Off")} />
          <Slider label="Take profit" value={common.takeProfitPct} min={0} max={200} step={5} onChange={(v) => props.setCommon({ takeProfitPct: v })} format={(v) => (v ? `${v}%` : "Off")} />
          <button onClick={() => setShowCosts(!showCosts)} className="label hover:text-fg">{showCosts ? "Hide" : "Show"} costs and sizing</button>
          <AnimatePresence initial={false}>
            {showCosts && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease }} className="space-y-5 overflow-hidden">
                <Slider label="Fee per side" value={common.feePct} min={0} max={1} step={0.01} onChange={(v) => props.setCommon({ feePct: v })} format={(v) => `${v.toFixed(2)}%`} hint="Typical exchange taker fees are 0.1%." />
                <Slider label="Slippage per side" value={common.slippagePct} min={0} max={1} step={0.01} onChange={(v) => props.setCommon({ slippagePct: v })} format={(v) => `${v.toFixed(2)}%`} />
                <Slider label="Position size" value={common.positionSizePct} min={10} max={100} step={5} onChange={(v) => props.setCommon({ positionSizePct: v })} format={(v) => `${v}% of equity`} hint="No leverage. Ever." />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Step>

      <Step n="03" title="Market">
        <div className="grid grid-cols-2 gap-2.5">
          {datasets.map((d) => {
            const on = props.data.kind === "dataset" && props.data.id === d.id;
            return (
              <motion.button key={d.id} whileTap={{ scale: 0.97 }} onClick={() => props.setData({ kind: "dataset", id: d.id })} className={`relative overflow-hidden rounded-lg border p-3 text-left transition-colors ${on ? "border-phos/70 bg-phos/[0.06]" : "border-line hover:border-line2"}`} aria-pressed={on}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[13px] font-medium leading-tight">{d.name}</span>
                  {on && <motion.span layoutId="ds-check" className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-phos text-black"><IconCheck className="h-3 w-3" strokeWidth={3} /></motion.span>}
                </div>
                <div className="mt-2"><Spark data={d.spark} color={d.kind === "real" ? "#c6ff3d" : "#ffb83d"} /></div>
                <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider">
                  <span className={d.kind === "real" ? "text-phos" : "text-amber"}>{d.kind}</span><span className="text-faint">{date(d.from).slice(0, 4)}-{date(d.to).slice(0, 4)}</span>
                </div>
              </motion.button>
            );
          })}
          <button onClick={() => fileRef.current?.click()} className={`flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-3 text-center transition-colors ${props.data.kind === "csv" ? "border-ice/70 bg-ice/[0.06]" : "border-line2 hover:border-ice/60"}`}>
            <IconUpload className="h-4 w-4 text-ice" />
            <span className="text-[13px] leading-tight">{props.data.kind === "csv" ? props.data.name : "Upload CSV"}</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-faint">{props.data.kind === "csv" ? `${props.data.rows} rows` : "time,open,high,low,close,volume"}</span>
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
        {props.uploadError && <p className="mt-2 text-[12px] text-loss">{props.uploadError}</p>}
        <p className="mt-3 text-[12px] leading-snug text-faint">Real = daily candles from Binance's public market-data endpoint, bundled in the repo. Synthetic = generated, and labelled everywhere it appears.</p>
      </Step>

      <div className="p-5 sm:p-6">
        <Button size="lg" className="w-full" onClick={props.onRun} disabled={props.running || !props.rules}>
          {props.running ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />Running in sandbox</> : "Run in sandbox"}
        </Button>
        <p className="mt-3 text-center text-[11px] text-faint">Paper only. Nothing is ever sent to an exchange.</p>
      </div>
    </div>
  );
}
