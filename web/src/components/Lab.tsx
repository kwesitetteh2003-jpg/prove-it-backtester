import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Config, type DatasetInfo, type Rules, type RunOut, type StrategySpec } from "../lib/api";
import { Builder, type Common, type DataChoice, type Params, type TemplateId } from "./Builder";
import { ContainmentLab } from "./ContainmentLab";
import { Pipeline } from "./Pipeline";
import { ResultsView } from "./Results";
import { ease } from "./ui";

type Tab = "backtest" | "containment";

function deriveParams(spec: StrategySpec): Params | null {
  const e = spec.entry[0], x = spec.exit[0];
  if (spec.template === "ma_cross" && e?.left.kind === "indicator" && e.right.kind === "indicator")
    return { kind: e.left.name === "ema" ? "ema" : "sma", fast: e.left.period ?? 20, slow: e.right.period ?? 50 };
  if (spec.template === "rsi_reversion" && e?.left.kind === "indicator" && e.right.kind === "value")
    return { period: e.left.period ?? 14, oversold: e.right.value, overbought: x?.right.kind === "value" ? x.right.value : 55 };
  if (spec.template === "breakout" && e?.right.kind === "indicator")
    return { lookback: e.right.period ?? 20, exitLookback: x?.right.kind === "indicator" ? x.right.period ?? 10 : 10 };
  return null;
}

const toCommonBody = (c: Common) => ({
  feePct: c.feePct, slippagePct: c.slippagePct, positionSizePct: c.positionSizePct,
  ...(c.stopLossPct > 0 ? { stopLossPct: c.stopLossPct } : {}), ...(c.takeProfitPct > 0 ? { takeProfitPct: c.takeProfitPct } : {}),
});

function Empty() {
  const reduce = useReducedMotion();
  return (
    <div className="relative grid min-h-[520px] place-items-center overflow-hidden rounded-xl border border-dashed border-line2 p-8 text-center">
      <div className="grid-bg absolute inset-0 opacity-60" aria-hidden />
      <svg viewBox="0 0 600 200" className="absolute inset-x-0 top-1/2 w-full -translate-y-1/2 opacity-60" aria-hidden preserveAspectRatio="none">
        <motion.path d="M0,150 C60,140 90,170 150,120 S250,100 300,110 S400,40 470,60 S560,30 600,20" fill="none" stroke="#c6ff3d" strokeWidth="1.5" strokeOpacity=".45" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.4, ease, repeat: Infinity, repeatType: "reverse", repeatDelay: 1 }} />
        <path d="M0,150 C80,130 150,150 220,135 S380,120 450,100 S560,80 600,70" fill="none" stroke="#6fe7ff" strokeWidth="1" strokeOpacity=".2" />
      </svg>
      <div className="relative max-w-sm">
        <div className="label text-phos">Awaiting run</div>
        <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight">Nothing proven yet.</h2>
        <p className="mt-3 text-[14px] leading-relaxed text-dim">Describe an idea, check the rules the engine understood, then run it. You will get a verdict, not just a curve.</p>
      </div>
    </div>
  );
}

export function Lab() {
  const [config, setConfig] = useState<Config | null>(null);
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [bootError, setBootError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("backtest");

  const [prompt, setPrompt] = useState("");
  const [typing, setTyping] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [mode, setMode] = useState<TemplateId | "custom">("ma_cross");
  const [params, setParams] = useState<Params>({ kind: "sma", fast: 20, slow: 50 });
  const [common, setCommonState] = useState<Common>({ stopLossPct: 10, takeProfitPct: 0, feePct: 0.1, slippagePct: 0.05, positionSizePct: 100 });
  const [data, setData] = useState<DataChoice>({ kind: "dataset", id: "btc-usd-1d" });
  const [customSpec, setCustomSpec] = useState<StrategySpec | null>(null);
  const [builtSpec, setBuiltSpec] = useState<StrategySpec | null>(null);
  const [rules, setRules] = useState<Rules | null>(null);
  const [source, setSource] = useState("Template");
  const [notes, setNotes] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<RunOut | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [runKey, setRunKey] = useState(0);
  const resultsRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    Promise.all([api.config(), api.datasets()]).then(([c, d]) => { setConfig(c); setDatasets(d); }).catch((e) => setBootError(e.message));
  }, []);

  // Template mode: the server is the single source of truth for rule shapes.
  useEffect(() => {
    if (mode === "custom") return;
    let live = true;
    const id = setTimeout(() => {
      api.build(mode, params, toCommonBody(common)).then((r) => { if (live) { setBuiltSpec(r.spec); setRules(r.rules); } }).catch(() => {});
    }, 120);
    return () => { live = false; clearTimeout(id); };
  }, [mode, params, common]);

  const spec: StrategySpec | null = mode === "custom" && customSpec
    ? { ...customSpec, ...toCommonBody(common), stopLossPct: common.stopLossPct > 0 ? common.stopLossPct : undefined, takeProfitPct: common.takeProfitPct > 0 ? common.takeProfitPct : undefined }
    : builtSpec;

  const setCommon = useCallback((c: Partial<Common>) => setCommonState((x) => ({ ...x, ...c })), []);

  const translate = useCallback(async (text: string) => {
    setTranslating(true);
    try {
      const r = await api.parse(text);
      const s = r.spec;
      setCommonState((c) => ({ ...c, stopLossPct: s.stopLossPct ?? 0, takeProfitPct: s.takeProfitPct ?? 0, feePct: s.feePct, slippagePct: s.slippagePct, positionSizePct: s.positionSizePct }));
      const p = deriveParams(s);
      if (s.template !== "custom" && p) { setCustomSpec(null); setParams(p); setMode(s.template as TemplateId); }
      else { setCustomSpec(s); setMode("custom"); setRules(r.rules); }
      setSource(r.source === "llm" ? `LLM · ${r.model ?? ""}` : "Parsed");
      setNotes(r.notes ?? []);
      if (r.datasetHint && datasets.some((d) => d.id === r.datasetHint)) setData({ kind: "dataset", id: r.datasetHint });
    } catch (e) { setNotes([(e as Error).message]); } finally { setTranslating(false); }
  }, [datasets]);

  const typeExample = useCallback((text: string) => {
    setTyping(true); setNotes([]);
    if (reduce) { setPrompt(text); setTyping(false); void translate(text); return; }
    let i = 0;
    const id = setInterval(() => {
      i += 2; setPrompt(text.slice(0, i));
      if (i >= text.length) { clearInterval(id); setTyping(false); void translate(text); }
    }, 12);
  }, [reduce, translate]);

  const pickMode = (m: TemplateId) => {
    if (m === mode) return;
    const t = config?.templates.find((x) => x.id === m);
    setCustomSpec(null); setSource("Template"); setNotes([]);
    setParams({ ...(t?.defaults ?? {}) }); setMode(m);
  };

  const run = async () => {
    if (!spec) return;
    setRunning(true); setFinishing(false); setRunError(null); setResult(null);
    if (window.innerWidth < 1024) setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    const t0 = performance.now();
    try {
      const out = await api.run(spec, data.kind === "dataset" ? { datasetId: data.id } : { csv: { name: data.name, text: data.text } });
      const wait = reduce ? 0 : Math.max(0, 2100 - (performance.now() - t0));
      await new Promise((r) => setTimeout(r, wait));
      setFinishing(true);
      await new Promise((r) => setTimeout(r, reduce ? 0 : 450));
      setResult(out); setRunKey((k) => k + 1);
    } catch (e) { setRunError((e as Error).message); } finally { setRunning(false); setFinishing(false); }
  };

  const llm = config?.llm;
  const net = config?.sandbox.layers.find((l) => l.id === "net");

  return (
    <div className="mx-auto max-w-[1500px] px-5 pb-20 pt-24 sm:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div role="tablist" className="relative flex gap-1">
          {([["backtest", "Backtest"], ["containment", "Containment lab"]] as const).map(([id, l]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`relative px-4 py-2.5 font-mono text-[12px] uppercase tracking-[0.16em] transition-colors ${tab === id ? "text-fg" : "text-dim hover:text-fg"}`}>
              {l}
              {tab === id && <motion.span layoutId="labtab" className="absolute inset-x-3 -bottom-[17px] h-px bg-phos shadow-[0_0_12px_#c6ff3d]" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-wider">
          <span className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-dim"><i className={`h-1.5 w-1.5 rounded-full ${config?.sandbox.runnerReady ? "bg-phos" : "bg-loss"}`} />{config?.sandbox.runnerReady ? "Sandbox ready" : "Sandbox offline"}</span>
          {net && <span className={`hidden rounded-full border px-3 py-1.5 sm:block ${net.state === "enforced" ? "border-phos/30 text-phos" : "border-amber/30 text-amber"}`}>Net {net.state === "enforced" ? "isolated" : "not isolated"}</span>}
          <span className="rounded-full border border-line px-3 py-1.5 text-dim">{llm?.enabled ? `LLM ${llm.model}` : "Rule parser"}</span>
        </div>
      </div>

      {bootError && <div className="rounded-lg border border-loss/40 bg-loss/10 p-4 text-sm text-loss">Could not reach the API ({bootError}). Start the server with <code className="font-mono">npm run dev</code>.</div>}

      <AnimatePresence mode="wait">
        {tab === "containment" ? (
          <motion.div key="c" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.45, ease }}><ContainmentLab config={config} /></motion.div>
        ) : (
          <motion.div key="b" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.45, ease }} className="grid gap-6 grid-cols-1 lg:grid-cols-[440px_minmax(0,1fr)]">
            <div className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6.5rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
              {config ? (
                <Builder config={config} datasets={datasets} prompt={prompt} setPrompt={setPrompt} onTranslate={() => translate(prompt)} translating={translating} typing={typing}
                  onExample={typeExample} mode={mode} setMode={pickMode} params={params} setParam={(k, v) => setParams((p) => ({ ...p, [k]: v }))} common={common} setCommon={setCommon}
                  data={data} setData={setData} rules={rules} source={source} notes={notes} onRun={run} running={running} uploadError={uploadError} setUploadError={setUploadError} />
              ) : !bootError && <div className="panel h-[600px] animate-pulse" />}
            </div>
            <div ref={resultsRef} className="min-w-0 scroll-mt-24">
              <AnimatePresence mode="wait">
                {running ? (
                  <motion.div key="run" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }} className="grid min-h-[520px] place-items-center"><Pipeline done={finishing} /></motion.div>
                ) : runError ? (
                  <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-loss/40 bg-loss/10 p-6"><div className="label text-loss">Run failed</div><p className="mt-2 text-fg/90">{runError}</p></motion.div>
                ) : result ? (
                  <motion.div key={`res${runKey}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}><ResultsView out={result} /></motion.div>
                ) : (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Empty /></motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
