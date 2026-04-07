"use client";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}

export function Switch({ checked, onChange, disabled = false, size = "sm" }: SwitchProps) {
  const track = size === "sm" ? "h-4 w-7" : "h-5 w-9";
  const thumb = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  const translateOn = size === "sm" ? "translate-x-3.5" : "translate-x-4";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={[
        "relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
        track,
        checked ? "bg-accent" : "bg-border",
        disabled ? "opacity-40 cursor-not-allowed" : "",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block rounded-full bg-white shadow-sm transition-transform duration-200",
          thumb,
          checked ? translateOn : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  );
}
