export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className="relative inline-flex items-center justify-center rounded-xl bg-accent shadow-[0_8px_24px_-8px_var(--accent)]"
        style={{ width: size, height: size }}
      >
        <span
          className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/30 to-transparent"
          aria-hidden
        />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={size * 0.55}
          height={size * 0.55}
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="relative"
        >
          <path d="M12 2v20M2 12h20" />
        </svg>
      </span>
      <span className="text-base font-semibold tracking-tight text-foreground">
        Revvo<span className="text-accent">.</span>
      </span>
    </span>
  );
}
