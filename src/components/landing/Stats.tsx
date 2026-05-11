"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

const stats = [
  { value: 320, suffix: "+", label: "Lojas conectadas" },
  { value: 4800, suffix: "+", label: "Terminais no ar" },
  { value: 48, suffix: "M", label: "Impressões/mês", prefix: "" },
  { value: 27, suffix: "%", label: "Lift médio em sell-out" },
];

export function Stats() {
  return (
    <section className="relative py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-surface to-surface-secondary px-6 py-10 md:px-12 md:py-14">
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              background:
                "radial-gradient(ellipse 60% 80% at 50% 0%, color-mix(in oklch, var(--accent) 25%, transparent) 0%, transparent 70%)",
            }}
            aria-hidden
          />
          <div className="relative grid grid-cols-2 gap-y-10 md:grid-cols-4">
            {stats.map((s) => (
              <StatItem key={s.label} {...s} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function StatItem({
  value,
  suffix,
  prefix,
  label,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const duration = 1400;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
      className="text-center"
    >
      <div className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
        {prefix}
        {n.toLocaleString("pt-BR")}
        <span className="text-accent">{suffix}</span>
      </div>
      <div className="mt-2 text-xs uppercase tracking-wider text-muted md:text-sm">
        {label}
      </div>
    </motion.div>
  );
}
