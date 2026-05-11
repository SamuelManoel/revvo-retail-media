import { Logo } from "./Logo";
import { WHATSAPP_DISPLAY, whatsappLink } from "./whatsapp";

const groups = [
  {
    title: "Produto",
    links: [
      { label: "Como funciona", href: "#como-funciona" },
      { label: "Para quem", href: "#para-quem" },
      { label: "Recursos", href: "#recursos" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { label: "Contato", href: "#contato" },
      { label: "Entrar", href: "/login" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Termos", href: "#" },
      { label: "Privacidade", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative border-t border-border/60 bg-surface/40 py-14 backdrop-blur-sm">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
            Plataforma de retail media para varejo brasileiro. Conectamos
            indústria, lojas e dados num só painel.
          </p>
          <a
            href={whatsappLink()}
            target="_blank"
            rel="noopener"
            className="mt-5 inline-flex items-center gap-2 text-sm text-muted transition hover:text-accent"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-accent">
              <svg width="14" height="14" viewBox="0 0 32 32" fill="currentColor">
                <path d="M19.11 17.21c-.27-.14-1.6-.79-1.85-.88-.25-.09-.43-.14-.61.14-.18.27-.7.88-.86 1.06-.16.18-.32.2-.59.07-.27-.14-1.14-.42-2.17-1.35-.8-.71-1.34-1.6-1.5-1.87-.16-.27-.02-.42.12-.55.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.61-1.47-.83-2.02-.22-.53-.45-.46-.62-.47l-.53-.01c-.18 0-.48.07-.73.34-.25.27-.95.93-.95 2.26 0 1.33.97 2.62 1.11 2.8.14.18 1.92 2.93 4.65 4.11.65.28 1.16.45 1.55.58.65.21 1.24.18 1.71.11.52-.08 1.6-.65 1.82-1.28.22-.63.22-1.18.16-1.28-.07-.11-.25-.18-.52-.32zM16.03 5.34c-5.91 0-10.71 4.8-10.71 10.71 0 1.89.5 3.74 1.44 5.36L5.34 26.66l5.41-1.41c1.56.85 3.31 1.31 5.1 1.31 5.91 0 10.71-4.8 10.71-10.71S21.94 5.34 16.03 5.34z" />
              </svg>
            </span>
            {WHATSAPP_DISPLAY}
          </a>
        </div>

        {groups.map((g) => (
          <div key={g.title}>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              {g.title}
            </h4>
            <ul className="mt-4 flex flex-col gap-2">
              {g.links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="text-sm text-muted transition hover:text-foreground"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-12 flex max-w-7xl flex-col items-start justify-between gap-3 border-t border-border/60 px-6 pt-6 text-xs text-muted md:flex-row md:items-center">
        <p>© {new Date().getFullYear()} Revvo Smart Price. Todos os direitos reservados.</p>
        <p>Feito no Brasil com café e dados.</p>
      </div>
    </footer>
  );
}
