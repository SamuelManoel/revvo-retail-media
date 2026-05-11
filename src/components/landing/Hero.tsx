"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const yBg = useTransform(scrollYProgress, [0, 1], [0, 160]);
  const yMock = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <section
      ref={ref}
      id="top"
      className="relative isolate overflow-hidden pt-32 pb-24 md:pt-40 md:pb-32"
    >
      {/* parallax glow background */}
      <motion.div
        style={{ y: yBg }}
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
      >
        <div className="absolute -top-32 left-1/2 h-[640px] w-[1100px] -translate-x-1/2 rounded-full bg-accent/20 blur-[160px]" />
        <div className="absolute top-40 -left-20 h-[420px] w-[420px] rounded-full bg-accent/10 blur-[120px]" />
        <div className="absolute -right-20 top-64 h-[360px] w-[360px] rounded-full bg-accent/15 blur-[120px]" />
      </motion.div>

      {/* grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.18]"
        aria-hidden
        style={{
          backgroundImage:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 30%, #000 40%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 30%, #000 40%, transparent 80%)",
        }}
      />

      <motion.div
        style={{ opacity }}
        className="mx-auto flex max-w-5xl flex-col items-center px-6 text-center"
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-surface/60 px-3 py-1 text-xs backdrop-blur-md"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          <span className="text-muted">Retail Media para o Varejo Brasileiro</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-6 text-balance text-5xl font-bold leading-[1.05] tracking-tight text-foreground md:text-7xl"
        >
          Transforme as telas do{" "}
          <span className="relative inline-block">
            <span className="bg-gradient-to-br from-accent to-emerald-400 bg-clip-text text-transparent">
              supermercado
            </span>
            <svg
              className="absolute -bottom-2 left-0 w-full text-accent/60"
              viewBox="0 0 200 12"
              fill="none"
              preserveAspectRatio="none"
            >
              <motion.path
                d="M2 8 Q 60 2, 100 6 T 198 4"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.2, delay: 0.8, ease: "easeOut" }}
              />
            </svg>
          </span>
          <br />
          em mídia que vende.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-7 max-w-2xl text-balance text-lg leading-relaxed text-muted md:text-xl"
        >
          Revvo conecta a indústria às telas do PDV. Anuncie no momento da
          decisão, gere <span className="text-foreground">insights de venda</span>{" "}
          em tempo real e crie uma nova fonte de receita para o varejo.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
        >
          <a
            href="#contato"
            className="group inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-[0_20px_50px_-18px_var(--accent)] transition hover:scale-[1.02] hover:opacity-95"
          >
            Solicitar demonstração
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform group-hover:translate-x-0.5"
            >
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </a>
          <a
            href="#como-funciona"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/40 px-6 py-3 text-sm font-medium text-foreground backdrop-blur-md transition hover:bg-surface"
          >
            Ver como funciona
          </a>
        </motion.div>

        {/* trust line */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted/80"
        >
          <span className="inline-flex items-center gap-1.5">
            <Check /> Integração com seu ERP
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Check /> Multi-loja, multi-empresa
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Check /> Sell-out em tempo real
          </span>
        </motion.div>
      </motion.div>

      {/* Mockup hero panel */}
      <motion.div
        style={{ y: yMock }}
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
        className="relative mx-auto mt-16 max-w-6xl px-6"
      >
        <div className="relative rounded-2xl border border-border/80 bg-surface/60 p-2 shadow-[0_60px_120px_-40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          {/* window bar */}
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-danger/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
            </div>
            <div className="rounded-md bg-surface-secondary px-2.5 py-0.5 font-mono text-[10px] text-muted">
              app.revvo.com.br/dashboard
            </div>
            <div className="h-2.5 w-12" />
          </div>

          <div className="grid gap-2 rounded-xl bg-background/60 p-3 md:grid-cols-[1fr_1.4fr]">
            {/* left column: stats */}
            <div className="flex flex-col gap-2">
              <StatCard
                label="Impressões hoje"
                value="2.41M"
                delta="+12,4%"
              />
              <StatCard
                label="Sell-out promocional"
                value="R$ 184k"
                delta="+8,1%"
              />
              <div className="rounded-xl border border-border/80 bg-surface p-4">
                <div className="text-[11px] uppercase tracking-wide text-muted">
                  Campanhas no ar
                </div>
                <div className="mt-3 flex flex-col gap-2.5">
                  {[
                    { name: "Coca-Cola • Verão 26", pct: 78 },
                    { name: "Nestlé • Café Premium", pct: 62 },
                    { name: "Unilever • Limpeza", pct: 44 },
                  ].map((c) => (
                    <div key={c.name}>
                      <div className="mb-1 flex justify-between text-[11px] text-foreground/80">
                        <span>{c.name}</span>
                        <span className="text-muted">{c.pct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-tertiary">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${c.pct}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 1.1, ease: "easeOut" }}
                          className="h-full rounded-full bg-gradient-to-r from-accent to-emerald-400"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* right: TV mock */}
            <div className="relative overflow-hidden rounded-xl border border-border/80 bg-gradient-to-br from-surface to-surface-secondary p-4">
              <div className="flex items-center justify-between text-[11px] text-muted">
                <span>TERMINAL #04 • Loja Vila Nova</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  ao vivo
                </span>
              </div>
              <div className="relative mt-3 aspect-video overflow-hidden rounded-lg bg-black">
                {/* faux ad creative */}
                <div className="absolute inset-0 bg-gradient-to-br from-accent/40 via-emerald-700/30 to-black" />
                <motion.div
                  initial={{ x: -40, opacity: 0 }}
                  whileInView={{ x: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                  className="absolute left-6 top-6"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
                    Promoção do dia
                  </div>
                  <div className="mt-1 text-3xl font-bold text-white">
                    -30% em <span className="text-accent">cafés premium</span>
                  </div>
                  <div className="mt-2 inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-medium text-black">
                    Corredor 12 • até hoje
                  </div>
                </motion.div>
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.6, duration: 0.6 }}
                  className="absolute right-6 bottom-6 h-20 w-20 rounded-2xl bg-white/95 p-2 shadow-lg"
                >
                  <div className="grid h-full w-full place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 text-2xl font-black text-white">
                    ☕
                  </div>
                </motion.div>
                {/* sweeping shine */}
                <motion.div
                  className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                  animate={{ x: ["0%", "400%"] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                />
              </div>

              {/* tiny meta row */}
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  ["Alcance", "12.8k"],
                  ["Conversão", "6,3%"],
                  ["CPM", "R$ 9,40"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="rounded-lg border border-border/60 bg-background/60 py-2"
                  >
                    <div className="text-[10px] uppercase tracking-wide text-muted">
                      {k}
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      {v}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* glow under panel */}
        <div className="pointer-events-none absolute inset-x-12 -bottom-10 h-32 rounded-full bg-accent/30 blur-3xl" />
      </motion.div>
    </section>
  );
}

function StatCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: string;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-surface p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">
          {delta}
        </span>
      </div>
    </div>
  );
}

function Check() {
  return (
    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent/20">
      <svg
        width="9"
        height="9"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-accent"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}
