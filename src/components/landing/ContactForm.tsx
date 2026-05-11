"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SectionHeader } from "./HowItWorks";
import { WHATSAPP_NUMBER, WHATSAPP_DISPLAY, whatsappLink } from "./whatsapp";

const roles = ["Indústria", "Varejo / Supermercado", "Agência", "Outro"];

type FormState = {
  name: string;
  company: string;
  email: string;
  phone: string;
  role: string;
  message: string;
};

const initial: FormState = {
  name: "",
  company: "",
  email: "",
  phone: "",
  role: "",
  message: "",
};

export function ContactForm() {
  const [form, setForm] = useState<FormState>(initial);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const update =
    <K extends keyof FormState>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [k]: e.target.value }));
      setError(null);
      setStatus("idle");
    };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !form.name ||
      !form.company ||
      !form.email ||
      !form.phone ||
      !form.role
    ) {
      setError("Preencha os campos obrigatórios.");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "Erro ao enviar. Tente novamente.");
        setStatus("error");
        return;
      }
      setStatus("ok");
      setForm(initial);
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setStatus("error");
    }
  }

  return (
    <section id="contato" className="relative overflow-hidden py-28">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/3 h-[460px] w-[1000px] -translate-x-1/2 rounded-full bg-accent/15 blur-[160px]" />
      </div>

      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          eyebrow="Vamos conversar"
          title={
            <>
              Pronto para colocar a{" "}
              <span className="text-accent">sua tela no ar</span>?
            </>
          }
          desc="Em até 1 dia útil um especialista responde com um plano feito para o seu cenário."
        />

        <div className="mx-auto mt-14 grid max-w-6xl gap-8 lg:grid-cols-[1fr_1.2fr]">
          <SideInfo />

          <motion.form
            onSubmit={submit}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="relative rounded-3xl border border-border/80 bg-surface/60 p-6 backdrop-blur-xl md:p-8"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Nome"
                required
                value={form.name}
                onChange={update("name")}
                placeholder="Seu nome completo"
              />
              <Field
                label="Empresa"
                required
                value={form.company}
                onChange={update("company")}
                placeholder="Razão social ou marca"
              />
              <Field
                label="E-mail"
                type="email"
                required
                value={form.email}
                onChange={update("email")}
                placeholder="voce@empresa.com"
              />
              <Field
                label="WhatsApp / Telefone"
                required
                value={form.phone}
                onChange={update("phone")}
                placeholder="(11) 99999-9999"
              />
              <div className="md:col-span-2">
                <Label>Você é</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {roles.map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => {
                        setForm((f) => ({ ...f, role: r }));
                        setError(null);
                      }}
                      className={`rounded-full border px-3.5 py-1.5 text-xs transition ${
                        form.role === r
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-border bg-surface text-foreground hover:border-accent/60"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <Label>Mensagem</Label>
                <textarea
                  rows={4}
                  value={form.message}
                  onChange={update("message")}
                  placeholder="Quantas lojas? Qual seu objetivo?"
                  className="mt-1.5 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent-soft-hover"
                />
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-6 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-muted">
                Ao enviar você concorda com nossa política de privacidade.
              </p>
              <button
                type="submit"
                disabled={status === "loading" || status === "ok"}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-accent-foreground shadow-[0_18px_40px_-16px_var(--accent)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {status === "ok" ? (
                  <>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Enviado!
                  </>
                ) : status === "loading" ? (
                  "Enviando..."
                ) : (
                  <>
                    Enviar solicitação
                    <svg
                      width="14"
                      height="14"
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
                  </>
                )}
              </button>
            </div>
          </motion.form>
        </div>
      </div>
    </section>
  );
}

function SideInfo() {
  const url = whatsappLink(
    "Olá, vim pelo site da Revvo e quero saber mais sobre o retail media."
  );
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5 }}
      className="flex flex-col gap-4"
    >
      <div className="rounded-3xl border border-border/80 bg-surface/60 p-8 backdrop-blur-xl">
        <h3 className="text-xl font-semibold text-foreground">
          Fale agora pelo WhatsApp
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Resposta em minutos durante o horário comercial. Ideal para quem
          quer começar uma piloto ainda esse mês.
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener"
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_18px_40px_-16px_#25D366] transition hover:opacity-95"
        >
          <WhatsAppGlyph />
          {WHATSAPP_DISPLAY}
        </a>
      </div>

      <div className="rounded-3xl border border-border/80 bg-surface/60 p-8 backdrop-blur-xl">
        <h4 className="text-sm font-semibold uppercase tracking-wider text-muted">
          O que acontece depois
        </h4>
        <ol className="mt-4 flex flex-col gap-4">
          {[
            ["Recebemos seu contato", "em até 1 dia útil"],
            ["Conversa rápida de 20min", "entendemos seu cenário"],
            ["Plano e estimativa", "feito sob medida para a sua rede"],
          ].map(([t, s], i) => (
            <li key={t} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                {i + 1}
              </span>
              <div>
                <div className="text-sm font-medium text-foreground">{t}</div>
                <div className="text-xs text-muted">{s}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <p className="px-2 text-[11px] text-muted/80">
        WhatsApp comercial: {WHATSAPP_NUMBER}
      </p>
    </motion.div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium uppercase tracking-wider text-muted">
      {children}
    </label>
  );
}

function Field({
  label,
  required,
  ...rest
}: {
  label: string;
  required?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        {label}
        {required && <span className="ml-0.5 text-accent">*</span>}
      </Label>
      <input
        {...rest}
        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent-soft-hover"
      />
    </div>
  );
}

function WhatsAppGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-hidden
    >
      <path d="M19.11 17.21c-.27-.14-1.6-.79-1.85-.88-.25-.09-.43-.14-.61.14-.18.27-.7.88-.86 1.06-.16.18-.32.2-.59.07-.27-.14-1.14-.42-2.17-1.35-.8-.71-1.34-1.6-1.5-1.87-.16-.27-.02-.42.12-.55.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.61-1.47-.83-2.02-.22-.53-.45-.46-.62-.47l-.53-.01c-.18 0-.48.07-.73.34-.25.27-.95.93-.95 2.26 0 1.33.97 2.62 1.11 2.8.14.18 1.92 2.93 4.65 4.11.65.28 1.16.45 1.55.58.65.21 1.24.18 1.71.11.52-.08 1.6-.65 1.82-1.28.22-.63.22-1.18.16-1.28-.07-.11-.25-.18-.52-.32zM16.03 5.34c-5.91 0-10.71 4.8-10.71 10.71 0 1.89.5 3.74 1.44 5.36L5.34 26.66l5.41-1.41c1.56.85 3.31 1.31 5.1 1.31 5.91 0 10.71-4.8 10.71-10.71S21.94 5.34 16.03 5.34zm0 19.34c-1.65 0-3.27-.44-4.69-1.28l-.34-.2-3.21.84.86-3.13-.22-.36c-.92-1.46-1.4-3.15-1.4-4.88 0-5.07 4.13-9.19 9.19-9.19s9.19 4.13 9.19 9.19c0 5.07-4.13 9.18-9.19 9.18z" />
    </svg>
  );
}
