"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SectionHeader } from "./HowItWorks";

const faq = [
  {
    q: "Preciso trocar meu PDV ou ERP atual?",
    a: "Não. A Revvo se conecta ao seu sistema atual via integração de catálogo. A gestão de preços continua no seu ERP — nós só sincronizamos.",
  },
  {
    q: "Quanto custa instalar nas minhas lojas?",
    a: "O modelo é compartilhado com a indústria anunciante. Para a maior parte das redes, o investimento inicial é zero e a receita da mídia paga os terminais.",
  },
  {
    q: "Como funciona a aprovação dos criativos?",
    a: "A indústria envia pelo painel. O varejo (ou o time Revvo) aprova antes de ir ao ar. Tudo auditável, com versionamento e log de quem aprovou.",
  },
  {
    q: "Que tipo de dados a indústria recebe?",
    a: "Impressões por loja, alcance estimado, tempo de exibição e — quando integrado ao PDV — sell-out comparado ao período sem campanha.",
  },
  {
    q: "Funciona para redes pequenas e médias?",
    a: "Sim. A plataforma é multi-loja desde o primeiro dia. Operamos com redes de 3 lojas até dezenas de unidades.",
  },
];

export function FAQ() {
  return (
    <section className="relative py-28">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          eyebrow="Dúvidas"
          title={<>Perguntas frequentes.</>}
          desc="As mesmas que ouvimos toda semana — agora respondidas."
        />

        <div className="mx-auto mt-14 max-w-3xl divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-surface/40 backdrop-blur-xl">
          {faq.map((item, i) => (
            <Item key={i} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Item({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-6 px-6 py-5 text-left transition hover:bg-surface-secondary/40"
      >
        <span className="text-base font-medium text-foreground">{q}</span>
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background transition ${
            open ? "rotate-45 border-accent text-accent" : "text-muted"
          }`}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <p className="px-6 pb-5 text-sm leading-relaxed text-muted">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
