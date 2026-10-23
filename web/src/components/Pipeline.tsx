import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { IconCheck } from "./Icons";
import { ease } from "./ui";

const STAGES = ["Validate rules", "Spawn sandbox", "Load prices", "Simulate bars", "Stress-test", "Destroy sandbox"];

export function Pipeline({ done }: { done: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => Math.min(x + 1, STAGES.length - 1)), 340);
    return () => clearInterval(id);
  }, []);
  const at = done ? STAGES.length : i;
  return (
    <div className="panel brackets mx-auto max-w-md p-6">
      <div className="label mb-5 flex items-center gap-2 text-phos"><span className="h-2 w-2 animate-pulse rounded-full bg-phos" />Running</div>
      <ol className="space-y-3">
        {STAGES.map((s, k) => {
          const state = k < at ? "done" : k === at ? "active" : "wait";
          return (
            <motion.li key={s} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: k * 0.05, ease }} className="flex items-center gap-3 font-mono text-[13px]">
              <span className={`grid h-5 w-5 place-items-center rounded-full border transition-colors ${state === "done" ? "border-phos bg-phos text-black" : state === "active" ? "border-phos text-phos" : "border-line2 text-transparent"}`}>
                {state === "done" ? <IconCheck className="h-3 w-3" strokeWidth={3} /> : state === "active" ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-phos" /> : null}
              </span>
              <span className={state === "wait" ? "text-faint" : "text-fg"}>{s}</span>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
