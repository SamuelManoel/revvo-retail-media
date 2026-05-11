"use client";

import { motion } from "framer-motion";

const brands = [
  "Coca-Cola",
  "Nestlé",
  "Unilever",
  "P&G",
  "Ambev",
  "BRF",
  "JBS",
  "PepsiCo",
  "Bauducco",
  "M. Dias Branco",
];

export function Marquee() {
  return (
    <section className="relative border-y border-border/40 bg-surface/40 py-10 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6">
        <p className="mb-6 text-center text-xs uppercase tracking-[0.25em] text-muted">
          Construído para conectar quem produz e quem vende
        </p>
        <div
          className="relative overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
            WebkitMaskImage:
              "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
          }}
        >
          <motion.div
            className="flex gap-12 whitespace-nowrap"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
          >
            {[...brands, ...brands].map((b, i) => (
              <span
                key={`${b}-${i}`}
                className="text-xl font-semibold tracking-tight text-muted/70 transition hover:text-foreground"
              >
                {b}
              </span>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
