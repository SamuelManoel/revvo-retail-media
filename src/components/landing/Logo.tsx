import Image from "next/image";

type Props = {
  size?: number;
  withWordmark?: boolean;
  /**
   * "auto" usa o logo apropriado conforme o tema (escuro pra dark, claro pra light).
   * "light" força o logo de fundo escuro (glifo branco).
   * "dark"  força o logo de fundo claro (glifo preto).
   */
  variant?: "auto" | "light" | "dark";
  className?: string;
};

export function Logo({ size = 28, withWordmark = true, variant = "auto", className }: Props) {
  if (variant === "auto") {
    return (
      <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
        {/* light theme → glifo preto */}
        <Image
          src="/logo-branco.png"
          alt="Revvo"
          width={size}
          height={size}
          priority
          className="rounded-xl shadow-[0_8px_24px_-8px_var(--accent)] dark:hidden"
          style={{ width: size, height: size }}
        />
        {/* dark theme → glifo branco */}
        <Image
          src="/logo-preto.png"
          alt="Revvo"
          width={size}
          height={size}
          priority
          className="hidden rounded-xl shadow-[0_8px_24px_-8px_var(--accent)] dark:inline"
          style={{ width: size, height: size }}
        />
        {withWordmark && (
          <span className="text-base font-semibold tracking-tight text-foreground">
            Revvo<span className="text-accent">.</span>
          </span>
        )}
      </span>
    );
  }

  // Variantes forçadas
  const src = variant === "light" ? "/logo-preto.png" : "/logo-branco.png";
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <Image
        src={src}
        alt="Revvo"
        width={size}
        height={size}
        priority
        className="rounded-xl shadow-[0_8px_24px_-8px_var(--accent)]"
        style={{ width: size, height: size }}
      />
      {withWordmark && (
        <span className="text-base font-semibold tracking-tight text-foreground">
          Revvo<span className="text-accent">.</span>
        </span>
      )}
    </span>
  );
}
