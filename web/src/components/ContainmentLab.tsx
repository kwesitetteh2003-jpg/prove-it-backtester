import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { api, type Config, type ProbeOut } from "../lib/api";
import { IconCheck, IconWarn, IconX } from "./Icons";
import { Button, ease } from "./ui";

const ATTACKS = [
  { id: "env", title: "Steal a secret", code: "process.env.PROVEIT_CANARY_SECRET", why: "A canary secret is planted in the host process. Can the sandbox see it?" },
  { id: "fs", title: "Read the disk", code: "fs.readFileSync('/etc/passwd')", why: "Filesystem reads are denied by the Node permission model." },
  { id: "spawn", title: "Spawn a shell", code: "child_process.execSync('id')", why: "Process creation is denied, so no shell, no curl, no escape." },
  { id: "net", title: "Phone home", code: "fetch('https://example.com')", why: "Needs a network namespace. Enforced only where the host allows it." },
  { id: "loop", title: "Burn the CPU", code: "for (;;) {}", why: "The host enforces a wall-clock cap and sends SIGKILL." },
  { id: "memory", title: "Eat the RAM", code: "hog.push(new Array(1e6).fill(1))", why: "A V8 heap cap kills the process when it balloons." },
] as const;

type Res = { state: "idle" | "running" | "done" | "error"; out?: ProbeOut; error?: string };

const OUT = {
  blocked: { label: "Blocked", cls: "text-phos border-phos/40 bg-phos/10", Icon: IconCheck },
  killed: { label: "Killed", cls: "text-phos border-phos/40 bg-phos/10", Icon: IconCheck },
  allowed: { label: "Allowed", cls: "text-amber border-amber/40 bg-amber/10", Icon: IconWarn },
} as const;

export function ContainmentLab({ config }: { config: Config | null }) {
  const [res, setRes] = useState<Record<string, Res>>({});
  const [busy, setBusy] = useState(false);

  const fire = async (id: string) => {
    setRes((r) => ({ ...r, [id]: { state: "running" } }));
    const t0 = performance.now();
    try {
      const out = await api.probe(id);
      const wait = Math.max(0, 900 - (performance.now() - t0));
      await new Promise((r) => setTimeout(r, wait));
      setRes((r) => ({ ...r, [id]: { state: "done", out } }));
    } catch (e) {
      setRes((r) => ({ ...r, [id]: { state: "error", error: (e as Error).message } }));
    }
  };
  const all = async () => { setBusy(true); for (const a of ATTACKS) await fire(a.id); setBusy(false); };

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <div className="label text-phos">Containment lab</div>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">Attack the sandbox. Watch it hold.</h1>
          <p className="mt-4 text-[16px] leading-relaxed text-dim">Each button runs real hostile code inside the same kind of throw-away process that runs your backtests. Nothing is simulated except the target: a canary secret we planted so you can see it stay hidden.</p>
        </div>
        <Button onClick={all} disabled={busy}>{busy ? "Running attacks" : "Run all six"}</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ATTACKS.map((a, i) => {
          const r = res[a.id] ?? { state: "idle" as const };
          const o = r.out ? OUT[r.out.outcome] : null;
          return (
            <motion.div key={a.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07, duration: 0.7, ease }} className="panel brackets flex flex-col p-5">
              <div className="flex items-center justify-between"><span className="label text-faint">Attack 0{i + 1}</span>
                <AnimatePresence mode="wait">
                  {r.state === "running" && <motion.span key="r" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="label text-ice">Running</motion.span>}
                  {o && r.out && <motion.span key="d" initial={{ opacity: 0, scale: 0.6, rotate: -6 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 420, damping: 22 }} className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[11px] uppercase tracking-widest ${o.cls}`}><o.Icon className="h-3 w-3" />{o.label}</motion.span>}
                  {r.state === "error" && <span key="e" className="label text-loss">Error</span>}
                </AnimatePresence>
              </div>
              <h3 className="mt-3 text-xl font-semibold tracking-tight">{a.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-dim">{a.why}</p>
              <pre className="mt-4 overflow-x-auto rounded-md border border-line bg-black/50 p-3 font-mono text-[12px] text-fg/90"><span className="text-faint">&gt; </span>{a.code}</pre>
              <div className="mt-3 min-h-[3.5rem] flex-1 font-mono text-[12px] leading-relaxed">
                {r.state === "running" && <div className="text-dim">spawning sandbox<span className="inline-block h-3 w-1.5 translate-y-0.5 animate-blink bg-phos" /></div>}
                {r.state === "done" && r.out && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
                    <div className={r.out.outcome === "allowed" ? "text-amber" : "text-phos"}>{r.out.detail}</div>
                    <div className="text-faint">pid {r.out.sandbox.pid ?? "n/a"} · {r.out.sandbox.wallMs} ms{r.out.sandbox.killedBy ? ` · killed by ${r.out.sandbox.killedBy}` : ""} · destroyed</div>
                  </motion.div>
                )}
                {r.state === "error" && <div className="text-loss">{r.error}</div>}
              </div>
              <button onClick={() => fire(a.id)} disabled={r.state === "running" || busy} className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line2 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hover:border-phos hover:text-phos disabled:opacity-40">{r.state === "done" ? "Fire again" : "Fire"}</button>
            </motion.div>
          );
        })}
      </div>

      {config && (
        <div>
          <div className="label mb-4">Layers on this host</div>
          <ul className="grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-2">
            {config.sandbox.layers.map((l, i) => (
              <motion.li key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.05 }} className="flex gap-4 bg-bg p-5">
                <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border ${l.state === "enforced" ? "border-phos/40 text-phos" : "border-amber/40 text-amber"}`}>{l.state === "enforced" ? <IconCheck className="h-3.5 w-3.5" /> : <IconX className="h-3.5 w-3.5" />}</span>
                <div><div className="flex items-center gap-3"><h4 className="font-medium">{l.label}</h4><span className={`font-mono text-[10px] uppercase tracking-widest ${l.state === "enforced" ? "text-phos" : "text-amber"}`}>{l.state === "enforced" ? "enforced" : "not available"}</span></div><p className="mt-1 text-[13px] leading-relaxed text-dim">{l.detail}</p></div>
              </motion.li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
