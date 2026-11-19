interface SpinnerProps {
  size?: number;
  tone?: "dark" | "light" | "brand";
  className?: string;
  /** Accessible label; omit when a visible label is next to the spinner. */
  label?: string;
}

const TONES = {
  dark: "border-navy-600/20 border-t-navy-600",
  light: "border-white/30 border-t-white",
  brand: "border-navy-600/15 border-t-brand-500",
};

export default function Spinner({ size = 16, tone = "dark", className = "", label }: SpinnerProps) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`inline-block shrink-0 animate-spin rounded-full border-2 ${TONES[tone]} ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/** Centered spinner for a section that is loading. */
export function LoadingBlock({ label = "Loading…", className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted ${className}`} role="status">
      <Spinner size={24} tone="brand" />
      {label}
    </div>
  );
}
