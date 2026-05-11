"use client";

import { motion } from "framer-motion";

export function CTA() {
  return (
    <section className="relative px-6 py-20">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6 }}
        className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-border/80 bg-gradient-to-br from-surface to-surface-secondary p-10 text-center md:p-16"
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 80% at 50% 0%, color-mix(in oklch, var(--accent) 30%, transparent) 0%, transparent 70%)",
          }}
          aria-hidden
        />
        <div className="relative">
          <h2 className="mx-auto max-w-2xl text-balance text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            Sua próxima campanha pode estar{" "}
            <span className="bg-gradient-to-r from-accent to-emerald-400 bg-clip-text text-transparent">
              no ar essa semana
            </span>
            .
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-muted">
            A gente cuida da tecnologia. Você cuida do crescimento.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#contato"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-[0_20px_50px_-18px_var(--accent)] transition hover:opacity-95"
            >
              Quero falar com um especialista
            </a>
            <a
              href="/login"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-6 py-3 text-sm font-medium text-foreground transition hover:bg-surface-secondary"
            >
              Já sou cliente
            </a>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
