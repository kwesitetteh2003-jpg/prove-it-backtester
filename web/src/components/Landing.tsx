import { motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { HeroCanvas } from "./HeroCanvas";
import { IconArrow, IconCheck, IconShield } from "./Icons";
import { Button, Counter, Reveal, SectionLabel, ease } from "./ui";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.25 } } };
const rise = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 0.9, ease } } };

function Hero() {
  return (
    <section className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden">
      <div className="grid-bg absolute inset-0 opacity-60" aria-hidden />
      <HeroCanvas />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-bg/70" aria-hidden />
      <motion.div variants={stagger} initial="hidden" animate="show" className="relative mx-auto w-full max-w-[1500px] px-5 pb-10 pt-32 sm:px-8 lg:pb-14">
        <motion.div variants={rise} className="label mb-7 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-2 text-phos"><span className="relative flex h-2 w-2"><span className="absolute inset-0 animate-pulse-ring rounded-full bg-phos" /><span className="relative h-2 w-2 rounded-full bg-phos" /></span>Sandbox online</span>
          <span className="hidden h-3 w-px bg-line2 sm:block" />
          <span>Vultr Agent Rush · Blast Radius Zero</span>
        </motion.div>
        <motion.h1 variants={rise} className="max-w-5xl text-balance text-[clamp(2.6rem,8.2vw,7.6rem)] font-semibold leading-[0.94] tracking-[-0.045em]">
          Prove it before<br />you <span className="text-phos">risk it.</span>
        </motion.h1>
        <motion.p variants={rise} className="mt-7 max-w-xl text-balance text-[17px] leading-relaxed text-dim sm:text-lg">
          Describe a trading idea in plain English. It becomes rules, runs inside a throw-away sandbox over real market history, and comes back with a verdict that tells you where it is flattering you.
        </motion.p>
        <motion.div variants={rise} className="mt-9 flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={() => (window.location.hash = "#/lab")}>Launch the lab <IconArrow className="h-4 w-4" /></Button>
          <Button size="lg" variant="ghost" onClick={() => document.getElementById("containment")?.scrollIntoView({ behavior: "smooth" })}>See the containment</Button>
        </motion.div>
        <motion.dl variants={rise} className="mt-14 grid max-w-3xl grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
          {[["0", "exchange connections"], ["1", "sandbox per run"], ["11", "honesty checks"]].map(([n, l]) => (
            <div key={l} className="bg-bg/80 px-4 py-4 backdrop-blur sm:px-6">
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-dim sm:text-[11px]">{l}</dt>
              <dd className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl"><Counter value={Number(n)} decimals={0} delay={1.0} /></dd>
            </div>
          ))}
        </motion.dl>
      </motion.div>
    </section>
  );
}

const steps = [
  { t: "Describe", d: "Write the idea the way you would say it. Moving-average crossovers, RSI dips, breakouts, with stops and take-profits.", viz: "type" },
  { t: "Translate", d: "The text becomes a small, typed rule set. A model may write it, but it can only emit data: never code.", viz: "rules" },
  { t: "Contain", d: "Every run gets a fresh process with no network, no files, no secrets, and a hard clock. Then it is destroyed.", viz: "box" },
  { t: "Confront", d: "Returns beside buy-and-hold, then a battery of checks built to break the result before you believe it.", viz: "verdict" },
] as const;

function StepViz({ kind }: { kind: (typeof steps)[number]["viz"] }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  const text = "buy when the 20 day average crosses above the 50 day";
  useEffect(() => {
    if (kind !== "type" || !inView) return;
    if (reduce) { setN(text.length); return; }
    const id = setInterval(() => setN((x) => (x >= text.length ? 0 : x + 1)), 70);
    return () => clearInterval(id);
  }, [inView, kind, reduce]);
  return (
    <div ref={ref} className="relative mb-6 flex h-32 items-center justify-center overflow-hidden rounded-md border border-line bg-black/40 p-4 font-mono text-[11px] leading-relaxed text-dim">
      {kind === "type" && <p className="w-full">{text.slice(0, n)}<span className="ml-px inline-block h-3 w-1.5 translate-y-0.5 animate-blink bg-phos" /></p>}
      {kind === "rules" && (
        <div className="w-full space-y-1.5">
          {["ENTRY  sma(20) crosses_above sma(50)", "EXIT   sma(20) crosses_below sma(50)", "RISK   stop 10%  size 100%"].map((l, i) => (
            <motion.div key={l} initial={{ opacity: 0, x: -10 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ delay: 0.15 * i + 0.2, duration: 0.6, ease }} className="flex items-center gap-2 text-fg/90">
              <IconCheck className="h-3 w-3 shrink-0 text-phos" />{l}
            </motion.div>
          ))}
        </div>
      )}
      {kind === "box" && (
        <div className="relative h-full w-full">
          {[0, 1, 2].map((i) => (
            <motion.div key={i} className="absolute inset-0 m-auto rounded border border-phos/50" style={{ width: 40 + i * 34, height: 40 + i * 22 }} initial={{ opacity: 0, scale: 0.6 }} animate={inView ? { opacity: 0.8 - i * 0.22, scale: 1 } : {}} transition={{ delay: 0.15 * i, duration: 0.7, ease }} />
          ))}
          <div className="absolute inset-0 m-auto h-2 w-2 rounded-full bg-phos shadow-[0_0_16px_#c6ff3d]" />
        </div>
      )}
      {kind === "verdict" && (
        <div className="w-full space-y-2">
          {[["Out-of-sample", 0.34, "text-amber"], ["Parameter nudges", 0.78, "text-phos"], ["2x trading costs", 0.55, "text-phos"]].map(([l, v, c], i) => (
            <div key={l as string} className="flex items-center gap-3">
              <span className="w-32 shrink-0 truncate">{l}</span>
              <div className="h-1 flex-1 overflow-hidden rounded bg-white/10"><motion.div className={`h-full rounded bg-current ${c}`} initial={{ width: 0 }} animate={inView ? { width: `${(v as number) * 100}%` } : {}} transition={{ delay: 0.2 + i * 0.15, duration: 1, ease }} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function How() {
  return (
    <section id="how" className="relative mx-auto max-w-[1500px] px-5 py-28 sm:px-8 lg:py-32">
      <Reveal><SectionLabel n="01">How it works</SectionLabel></Reveal>
      <Reveal delay={0.05}><h2 className="mt-6 max-w-3xl text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.035em] sm:text-6xl">From a sentence to a verdict in under a second.</h2></Reveal>
      <div className="mt-16 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-2 xl:grid-cols-4">
        {steps.map((s, i) => (
          <Reveal key={s.t} delay={i * 0.08} className="group bg-bg p-6 transition-colors hover:bg-bg2 sm:p-8">
            <StepViz kind={s.viz} />
            <div className="label text-faint">0{i + 1}</div>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">{s.t}</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-dim">{s.d}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const log: [string, string, "ok" | "deny" | "info"][] = [
  ["00:00", "spawn   node --permission --max-old-space-size=256", "info"],
  ["00:01", "env     process.env is empty. 0 variables", "ok"],
  ["00:02", "fs      read /etc/passwd  ->  ERR_ACCESS_DENIED", "deny"],
  ["00:03", "spawn   child_process.exec('curl ...')  ->  ERR_ACCESS_DENIED", "deny"],
  ["00:04", "net     fetch('https://example.com')  ->  blocked", "deny"],
  ["00:05", "loop    while(true){}  ->  SIGKILL at wall-clock cap", "deny"],
  ["00:06", "report  1,497 bars simulated in 17 ms", "ok"],
  ["00:07", "destroy scratch directory removed. process gone", "ok"],
];

function Containment() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });
  return (
    <section id="containment" className="relative border-y border-line bg-bg2/60">
      <div className="mx-auto grid max-w-[1500px] gap-14 px-5 py-28 sm:px-8 lg:grid-cols-[1fr_1.15fr] lg:py-32">
        <div>
          <Reveal><SectionLabel n="02">Blast Radius Zero</SectionLabel></Reveal>
          <Reveal delay={0.05}><h2 className="mt-6 text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.035em] sm:text-6xl">Assume the code is hostile. Contain it anyway.</h2></Reveal>
          <Reveal delay={0.1}><p className="mt-6 max-w-lg text-[17px] leading-relaxed text-dim">Strategies are data, validated twice, and run in a process that has nothing to steal and nowhere to go. You can fire real attacks at it from the Containment Lab and watch each one fail.</p></Reveal>
          <Reveal delay={0.15}>
            <ul className="mt-8 space-y-3">
              {["Empty environment: no keys to leak", "No filesystem or child-process access", "Memory and wall-clock caps, enforced by kill", "Optional network namespace where the host allows it"].map((t) => (
                <li key={t} className="flex items-center gap-3 text-[15px]"><IconShield className="h-4 w-4 text-phos" />{t}</li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.2}><div className="mt-10"><Button variant="ghost" onClick={() => (window.location.hash = "#/lab")}>Open the Containment Lab <IconArrow className="h-4 w-4" /></Button></div></Reveal>
        </div>
        <Reveal delay={0.1}>
          <div ref={ref} className="brackets panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-white/15" /><i className="h-2.5 w-2.5 rounded-full bg-white/15" /><i className="h-2.5 w-2.5 rounded-full bg-white/15" /></div>
              <span className="label">illustrative log · real attacks in the lab</span>
            </div>
            <div className="space-y-2 p-5 font-mono text-[12px] leading-relaxed sm:text-[13px]">
              {log.map(([t, m, k], i) => (
                <motion.div key={t} initial={{ opacity: 0, x: -8 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ delay: 0.25 + i * 0.28, duration: 0.5, ease }} className="flex gap-4">
                  <span className="text-faint">{t}</span>
                  <span className={k === "deny" ? "text-loss/90" : k === "ok" ? "text-phos" : "text-dim"}>{m}</span>
                </motion.div>
              ))}
              <div className="pt-1 text-faint">$ <span className="inline-block h-3.5 w-1.5 translate-y-0.5 animate-blink bg-phos" /></div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const checks = [
  ["No look-ahead", "Signals read at the close, fills at the next open."],
  ["Enough trades?", "Fewer than 30 trades is noise; fewer than 10 fails."],
  ["Beats buy-and-hold?", "Compared on the same bars, after costs."],
  ["Out-of-sample", "Same rules on the final 30% of history, unseen."],
  ["Parameter nudges", "Shift every knob by 20-25%. Does it survive?"],
  ["2x trading costs", "Double fees and slippage and rerun."],
  ["One lucky trade?", "How much profit hangs on a single winner."],
  ["Bootstrap", "Reshuffle the trades 500 times for a range of outcomes."],
];

function Honesty() {
  return (
    <section id="honesty" className="mx-auto max-w-[1500px] px-5 py-28 sm:px-8 lg:py-32">
      <div className="grid gap-14 lg:grid-cols-[1fr_1.2fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Reveal><SectionLabel n="03">The honest part</SectionLabel></Reveal>
          <Reveal delay={0.05}><h2 className="mt-6 text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.035em] sm:text-6xl">A good-looking backtest is the most dangerous kind.</h2></Reveal>
          <Reveal delay={0.1}><p className="mt-6 max-w-md text-[17px] leading-relaxed text-dim">Most tools show you the equity curve and stop. We show it, then spend a battery of checks trying to break it. Many ideas that look great do not survive. That is the product working.</p></Reveal>
          <Reveal delay={0.15}>
            <div className="mt-8 flex max-w-md items-center gap-4 rounded-lg border border-line p-4">
              <div className="flex shrink-0 flex-col whitespace-nowrap"><span className="label">Sample verdict</span><span className="mt-1 font-mono text-lg tracking-wide text-loss">NOT CREDIBLE</span></div>
              <span className="h-8 w-px bg-line2" />
              <p className="text-[13px] leading-snug text-dim">+49% looks fine until you see 6 trades, 73% of profit from one, and buy-and-hold at +1,030%.</p>
            </div>
          </Reveal>
        </div>
        <ul className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
          {checks.map(([t, d], i) => (
            <Reveal as="li" key={t} delay={(i % 2) * 0.06} className="group bg-bg p-6 transition-colors hover:bg-bg2">
              <div className="flex items-center justify-between"><span className="label text-faint">C{String(i + 1).padStart(2, "0")}</span><span className="h-1.5 w-1.5 rounded-full bg-line2 transition-colors group-hover:bg-phos" /></div>
              <h3 className="mt-6 text-lg font-semibold tracking-tight">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-dim">{d}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Closer() {
  return (
    <section className="relative overflow-hidden border-t border-line">
      <div className="grid-bg absolute inset-0 opacity-40" aria-hidden />
      <div className="relative mx-auto max-w-[1500px] px-5 py-28 text-center sm:px-8 lg:py-32">
        <Reveal><h2 className="mx-auto max-w-4xl text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.04em] sm:text-7xl">Try to make it <span className="text-phos">lie to you.</span></h2></Reveal>
        <Reveal delay={0.1}><div className="mt-10"><Button size="lg" onClick={() => (window.location.hash = "#/lab")}>Launch the lab <IconArrow className="h-4 w-4" /></Button></div></Reveal>
      </div>
      <footer className="relative border-t border-line">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-5 py-8 text-[12px] leading-relaxed text-faint sm:px-8 md:flex-row md:justify-between">
          <p className="max-w-3xl">Prove-It never places trades and never connects to an exchange or wallet. Backtests describe the past, not the future, and are not financial advice. Real price data is read from Binance's public market-data endpoint; synthetic datasets are labelled as such.</p>
          <p className="label shrink-0">Built for Vultr Agent Rush</p>
        </div>
      </footer>
    </section>
  );
}

export function Landing() {
  return <main><Hero /><How /><Containment /><Honesty /><Closer /></main>;
}
