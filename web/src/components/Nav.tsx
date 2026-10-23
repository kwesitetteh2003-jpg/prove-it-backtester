import { motion } from "framer-motion";
import { IconArrow, Logo } from "./Icons";

export function Nav({ route }: { route: "home" | "lab" }) {
  return (
    <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-0 z-50 border-b border-line/60 bg-bg/60 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1500px] items-center justify-between px-5 sm:px-8">
        <a href="#/" className="flex items-center gap-2.5" aria-label="Prove-It home">
          <Logo />
          <span className="font-mono text-[13px] font-medium uppercase tracking-[0.2em]">Prove<span className="text-phos">/</span>It</span>
        </a>
        <nav className="hidden items-center gap-8 md:flex">
          {route === "home" && [["How it works", "how"], ["Containment", "containment"], ["Honesty", "honesty"]].map(([l, id]) => (
            <a key={id} href={`#/${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id!)?.scrollIntoView({ behavior: "smooth" }); }} className="label transition-colors hover:text-fg">{l}</a>
          ))}
        </nav>
        {route === "home" ? (
          <a href="#/lab" className="group inline-flex items-center gap-2 rounded-md border border-line2 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hover:border-phos hover:text-phos">
            Launch lab <IconArrow className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </a>
        ) : (
          <a href="#/" className="label transition-colors hover:text-fg">Overview</a>
        )}
      </div>
    </motion.header>
  );
}
