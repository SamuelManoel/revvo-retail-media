"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { SectionHeader } from "./HowItWorks";

export function Showcase() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y1 = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const y2 = useTransform(scrollYProgress, [0, 1], [80, -80]);
  const y3 = useTransform(scrollYProgress, [0, 1], [120, -60]);

  return (
    <section ref={ref} className="relative overflow-hidden py-28">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          eyebrow="Live no PDV"
          title={
            <>
              Telas que <span className="text-accent">conversam</span> com
              quem está comprando.
            </>
          }
          desc="Mídias rotativas, ofertas relâmpago e campanhas temáticas — orquestradas em tempo real para cada loja."
        />
      </div>

      <div className="relative mt-20">
        {/* floor / horizon */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <div className="mx-auto flex max-w-7xl items-end justify-center gap-6 px-6 perspective-[1400px]">
          <motion.div style={{ y: y1 }} className="hidden md:block">
            <ScreenCard
              accent="from-rose-500/30 to-fuchsia-700/20"
              tag="Categoria: Bebidas"
              title="Coca-Cola"
              sub="Ofertas a partir de R$ 4,99"
              emoji="🥤"
              rotate={-8}
            />
          </motion.div>

          <motion.div style={{ y: y2 }} className="z-10">
            <ScreenCard
              accent="from-accent/40 to-emerald-700/20"
              tag="Promoção do dia"
              title="Café Premium"
              sub="-30% no corredor 12"
              emoji="☕"
              big
            />
          </motion.div>

          <motion.div style={{ y: y3 }} className="hidden md:block">
            <ScreenCard
              accent="from-sky-500/30 to-blue-700/20"
              tag="Higiene"
              title="Unilever"
              sub="Leve 3, pague 2"
              emoji="🧴"
              rotate={8}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function ScreenCard({
  accent,
  tag,
  title,
  sub,
  emoji,
  rotate = 0,
  big = false,
}: {
  accent: string;
  tag: string;
  title: string;
  sub: string;
  emoji: string;
  rotate?: number;
  big?: boolean;
}) {
  return (
    <div
      className="relative rounded-2xl border border-border/80 bg-surface/60 p-2 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)] backdrop-blur-xl"
      style={{
        transform: `rotate(${rotate}deg)`,
        width: big ? 360 : 280,
      }}
    >
      <div className="flex items-center justify-between px-2 pb-2 pt-1">
        <span className="text-[10px] uppercase tracking-wider text-muted">
          {tag}
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          live
        </span>
      </div>
      <div
        className={`relative aspect-[9/12] overflow-hidden rounded-xl bg-gradient-to-br ${accent}`}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 flex h-full flex-col justify-between p-5">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
              {tag}
            </div>
            <div className="mt-1 text-2xl font-bold leading-tight text-white">
              {title}
            </div>
          </div>
          <div className="text-6xl">{emoji}</div>
          <div className="inline-flex w-fit rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-black">
            {sub}
          </div>
        </div>
        <motion.div
          className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          animate={{ x: ["0%", "400%"] }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        />
      </div>
    </div>
  );
}
