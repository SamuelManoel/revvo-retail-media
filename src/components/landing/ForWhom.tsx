"use client";

import { motion } from "framer-motion";
import { SectionHeader } from "./HowItWorks";

const indústria = [
  "Visibilidade no momento exato da decisão de compra",
  "Segmentação por região, loja, corredor e produto",
  "Mensuração de sell-out com dados reais do varejo",
  "Negociação direta com redes parceiras, sem intermediários",
];

const varejo = [
  "Nova fonte de receita recorrente com a indústria",
  "Modernização do PDV com terminais inteligentes",
  "Gestão automática de preços e mídia integradas",
  "Transforma a tela da loja em ativo de negócio",
];

export function ForWhom() {
  return (
    <section id="para-quem" className="relative overflow-hidden py-28">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          eyebrow="Para quem"
          title={
            <>
              Dois lados,{" "}
              <span className="bg-gradient-to-r from-accent to-emerald-400 bg-clip-text text-transparent">
                uma plataforma só
              </span>
              .
            </>
          }
          desc="A Revvo foi desenhada para resolver o problema dos dois extremos do varejo brasileiro."
        />

        <div className="mt-16 grid gap-6 md:grid-cols-2">
          <Card
            tag="Para a Indústria"
            title="Anuncie onde o consumidor decide."
            items={indústria}
            accent="left"
          />
          <Card
            tag="Para o Varejo"
            title="Sua tela vira receita."
            items={varejo}
            accent="right"
          />
        </div>
      </div>
    </section>
  );
}

function Card({
  tag,
  title,
  items,
  accent,
}: {
  tag: string;
  title: string;
  items: string[];
  accent: "left" | "right";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55 }}
      className="group relative overflow-hidden rounded-3xl border border-border/80 bg-surface/40 p-8 backdrop-blur-xl md:p-10"
    >
      <div
        className={`pointer-events-none absolute h-[260px] w-[260px] rounded-full bg-accent/20 blur-3xl transition group-hover:bg-accent/30 ${
          accent === "left" ? "-left-20 -top-20" : "-right-20 -bottom-20"
        }`}
        aria-hidden
      />
      <div className="relative">
        <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-accent">
          {tag}
        </span>
        <h3 className="mt-5 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          {title}
        </h3>
        <ul className="mt-7 flex flex-col gap-3.5">
          {items.map((t, i) => (
            <motion.li
              key={t}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0.1 + i * 0.06 }}
              className="flex items-start gap-3 text-sm leading-relaxed text-foreground/85"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              {t}
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}
