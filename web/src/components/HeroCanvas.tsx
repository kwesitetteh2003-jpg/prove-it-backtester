import { useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

/** Generative price field: ghost strategies drifting left, one accent path with a live head marker. */
export function HeroCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let w = 0, h = 0, raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

    let seed = 7;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const LEN = 1600;
    // detrended + normalised to [-1, 1] so the loop is seamless and lines never jump vertically
    const walk = (vol: number) => {
      const a = [0];
      for (let i = 1; i < LEN; i++) a.push(a[i - 1]! + gauss() * vol);
      const end = a[LEN - 1]!;
      const d = a.map((v, i) => v - (end * i) / (LEN - 1));
      const lo = Math.min(...d), hi = Math.max(...d);
      return d.map((v) => ((v - lo) / (hi - lo)) * 2 - 1);
    };
    const ghosts = Array.from({ length: 16 }, (_, i) => ({ s: walk(1), a: 0.05 + rnd() * 0.07, off: rnd() * 0.8 - 0.4, depth: 0.35 + rnd() * 0.7, slope: (rnd() - 0.4) * 0.5, hue: i % 5 === 0 }));
    const hero = walk(1);

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    // under reduced motion there is no frame loop, so a resize must repaint the single static frame
    const ro = new ResizeObserver(() => { resize(); if (reduce) { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); } });
    ro.observe(canvas);

    const onMove = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); mouse.tx = (e.clientX - r.left) / r.width; mouse.ty = (e.clientY - r.top) / r.height; };
    window.addEventListener("pointermove", onMove);

    const step = 3.2; // px per sample
    const draw = (t: number) => {
      mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;
      ctx.clearRect(0, 0, w, h);
      const scroll = reduce ? 700 : t * 0.012;
      const cols = Math.ceil(w / step) + 2;
      const base = Math.floor(scroll);
      const frac = scroll - base;
      const mid = h * 0.58, amp = Math.min(h * 0.16, 130);
      const headX = w * 0.74;

      const series = (s: number[], depth: number, off: number, slope: number) => {
        const out: [number, number][] = [];
        for (let c = 0; c < cols; c++) {
          const idx = (base + c) % (LEN - 1);
          const v = s[idx]! + (s[idx + 1]! - s[idx]!) * frac;
          const rise = -slope * (c / cols) * amp * 1.4; // a gentle slope in screen space
          out.push([c * step - frac * step + (mouse.x - 0.5) * -26 * depth, mid + off * amp - v * amp * 0.55 * depth + rise + (mouse.y - 0.5) * 18 * depth]);
        }
        return out;
      };

      for (const g of ghosts) {
        const pts = series(g.s, g.depth, g.off, g.slope);
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.strokeStyle = g.hue ? `rgba(111,231,255,${g.a})` : `rgba(255,255,255,${g.a})`;
        ctx.lineWidth = 1; ctx.stroke();
      }

      const hp = series(hero, 1, 0.1, 0.9);
      // area under accent
      const grad = ctx.createLinearGradient(0, mid - amp, 0, h);
      grad.addColorStop(0, "rgba(198,255,61,0.16)"); grad.addColorStop(1, "rgba(198,255,61,0)");
      ctx.beginPath();
      let hx = 0, hy = 0;
      hp.forEach(([x, y], i) => { if (x <= headX) { hx = x; hy = y; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } });
      ctx.lineTo(hx, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

      ctx.beginPath();
      hp.forEach(([x, y], i) => { if (x <= headX) i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.shadowColor = "rgba(198,255,61,.7)"; ctx.shadowBlur = 14;
      ctx.strokeStyle = "#c6ff3d"; ctx.lineWidth = 1.8; ctx.stroke(); ctx.shadowBlur = 0;

      // live head
      const pulse = reduce ? 0.5 : (Math.sin(t / 380) + 1) / 2;
      ctx.beginPath(); ctx.arc(hx, hy, 4 + pulse * 10, 0, 7); ctx.fillStyle = `rgba(198,255,61,${0.16 - pulse * 0.1})`; ctx.fill();
      ctx.beginPath(); ctx.arc(hx, hy, 3.5, 0, 7); ctx.fillStyle = "#c6ff3d"; ctx.fill();
      ctx.beginPath(); ctx.moveTo(hx, 0); ctx.lineTo(hx, h); ctx.strokeStyle = "rgba(198,255,61,.14)"; ctx.setLineDash([2, 6]); ctx.stroke(); ctx.setLineDash([]);

      // faded forward region = the unknown future
      const fut = ctx.createLinearGradient(headX, 0, w, 0);
      fut.addColorStop(0, "rgba(5,6,10,0)"); fut.addColorStop(1, "rgba(5,6,10,.85)");
      ctx.fillStyle = fut; ctx.fillRect(headX, 0, w - headX, h);

      if (!reduce) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener("pointermove", onMove); };
  }, [reduce]);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden />;
}
