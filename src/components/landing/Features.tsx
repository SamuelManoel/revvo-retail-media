"use client";

import { motion } from "framer-motion";
import { SectionHeader } from "./HowItWorks";

const features = [
  {
    title: "Terminais inteligentes",
    desc: "Banner displays, price-checkers e totens conectados ao painel — atualização remota e monitoramento online.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
      </svg>
    ),
    span: "md:col-span-2",
  },
  {
    title: "Sincronização de preços",
    desc: "Integra com o seu ERP/PDV e mantém preços coerentes em todas as telas.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" />
      </svg>
    ),
  },
  {
    title: "Campanhas segmentadas",
    desc: "Por região, loja, horário, corredor, produto ou categoria — com agenda e prioridade.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" />
      </svg>
    ),
  },
  {
    title: "Catálogo de promoções",
    desc: "Monte ofertas, vincule mídias e ative em segundos. Versionamento e histórico completos.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 5H3v14h18z" /><path d="M3 10h18" />
      </svg>
    ),
    span: "md:col-span-2",
  },
  {
    title: "Dashboards & relatórios",
    desc: "Sell-out, alcance, conversão, tempo de exibição. Exportável para CSV e API.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" /><path d="M7 13l3-3 4 4 6-6" />
      </svg>
    ),
  },
  {
    title: "Multi-loja, multi-empresa",
    desc: "Arquitetura multi-tenant. Cada empresa só enxerga seus próprios dados.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 9h1M9 13h1M14 9h1M14 13h1M9 17h6" />
      </svg>
    ),
  },
];

export function Features() {
  return (
    <section id="recursos" className="relative py-28">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          eyebrow="Recursos"
          title={
            <>
              Tudo o que você precisa,{" "}
              <span className="text-accent">num só painel</span>.
            </>
          }
          desc="Da gestão dos terminais ao relatório enviado para a indústria — sem planilhas, sem chamado, sem suor."
        />

        <div className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}
              className={`group relative overflow-hidden rounded-2xl border border-border/80 bg-surface/50 p-6 backdrop-blur-xl transition hover:border-accent/40 hover:bg-surface ${
                f.span ?? ""
              }`}
            >
              {/* hover shimmer */}
              <div
                className="pointer-events-none absolute -inset-px opacity-0 transition group-hover:opacity-100"
                style={{
                  background:
                    "radial-gradient(420px circle at var(--x,50%) var(--y,50%), color-mix(in oklch, var(--accent) 16%, transparent), transparent 40%)",
                }}
                aria-hidden
              />
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  {f.icon}
                </div>
                <h3 className="mt-5 text-base font-semibold text-foreground">
                  {f.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  {f.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
