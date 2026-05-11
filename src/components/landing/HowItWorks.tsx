"use client";

import { motion } from "framer-motion";

const steps = [
  {
    n: "01",
    title: "Indústria cria a campanha",
    desc: "Envie criativos, defina público, regiões, lojas e produtos. Tudo num painel simples e auditável.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <path d="M3 9h18M8 14h2M8 17h6" />
      </svg>
    ),
  },
  {
    n: "02",
    title: "Varejo exibe nas telas",
    desc: "Banners, vídeos e ofertas rodam nos terminais, price-checkers e totens das lojas, sincronizados em tempo real.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </svg>
    ),
  },
  {
    n: "03",
    title: "Todos lucram com os dados",
    desc: "Sell-out, alcance e engajamento medidos por loja. Indústria otimiza a campanha, varejo aumenta o ticket.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 14l4-4 3 3 5-6" />
      </svg>
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="relative py-28">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          eyebrow="Como funciona"
          title={
            <>
              Três passos para virar o jogo do{" "}
              <span className="text-accent">retail media</span>.
            </>
          }
          desc="Da campanha à mensuração, a Revvo plugou o que o mercado ainda tratava como dois mundos separados."
        />

        <div className="mt-16 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group relative rounded-2xl border border-border/80 bg-surface/60 p-7 backdrop-blur-xl transition hover:-translate-y-1 hover:border-accent/40 hover:bg-surface"
            >
              <div className="pointer-events-none absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-accent/0 to-accent/0 opacity-0 transition group-hover:from-accent/10 group-hover:opacity-100" />
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  {s.icon}
                </div>
                <span className="font-mono text-xs tracking-wider text-muted/70">
                  {s.n}
                </span>
              </div>
              <h3 className="mt-6 text-lg font-semibold text-foreground">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* connecting line decoration */}
        <div className="pointer-events-none mx-auto mt-2 hidden h-px max-w-4xl bg-gradient-to-r from-transparent via-accent/40 to-transparent md:block" />
      </div>
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: React.ReactNode;
  desc?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5 }}
      className="mx-auto max-w-2xl text-center"
    >
      <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted backdrop-blur">
        <span className="h-1 w-1 rounded-full bg-accent" />
        {eyebrow}
      </div>
      <h2 className="mt-5 text-balance text-4xl font-bold tracking-tight text-foreground md:text-5xl">
        {title}
      </h2>
      {desc && (
        <p className="mt-5 text-balance text-base leading-relaxed text-muted md:text-lg">
          {desc}
        </p>
      )}
    </motion.div>
  );
}
