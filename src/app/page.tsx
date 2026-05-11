import type { Metadata } from "next";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Marquee } from "@/components/landing/Marquee";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ForWhom } from "@/components/landing/ForWhom";
import { Stats } from "@/components/landing/Stats";
import { Showcase } from "@/components/landing/Showcase";
import { Features } from "@/components/landing/Features";
import { FAQ } from "@/components/landing/FAQ";
import { CTA } from "@/components/landing/CTA";
import { ContactForm } from "@/components/landing/ContactForm";
import { Footer } from "@/components/landing/Footer";
import { WhatsAppFab } from "@/components/landing/WhatsAppFab";

export const metadata: Metadata = {
  title: "Revvo — Retail Media que transforma telas em receita",
  description:
    "A Revvo conecta indústria e varejo: exiba campanhas inteligentes nas telas dos supermercados, gere insights em tempo real e aumente as vendas de quem produz e de quem vende.",
};

export default function LandingPage() {
  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <Navbar />
      <Hero />
      <Marquee />
      <HowItWorks />
      <ForWhom />
      <Stats />
      <Showcase />
      <Features />
      <FAQ />
      <CTA />
      <ContactForm />
      <Footer />
      <WhatsAppFab />
    </main>
  );
}
