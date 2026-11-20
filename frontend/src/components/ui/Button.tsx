import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import Spinner from "./Spinner";

export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  // Navy: white text passes contrast. Use for the one main action on a screen.
  primary: "bg-navy-600 text-white hover:bg-navy-700 active:bg-navy-800 shadow-sm",
  // Brand orange needs dark text for contrast. Use sparingly (e.g. "Add candidate").
  accent: "bg-brand-500 text-ink hover:bg-brand-400 active:bg-brand-600 shadow-sm",
  secondary: "bg-white text-ink border border-line hover:bg-surface hover:border-line-strong shadow-sm",
  ghost: "bg-transparent text-ink-soft hover:bg-surface-sunken hover:text-ink",
  danger: "bg-danger-600 text-white hover:bg-danger-700 shadow-sm",
  link: "bg-transparent text-navy-600 hover:text-navy-800 hover:underline underline-offset-2 px-0 py-0 h-auto",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-md",
  md: "h-10 px-4 text-sm gap-2 rounded-lg",
  lg: "h-11 px-5 text-sm gap-2 rounded-lg",
};

/** Class string for things that look like buttons but aren't <button> (e.g. <Link>). */
export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = ""): string {
  return [
    "inline-flex items-center justify-center font-semibold whitespace-nowrap transition-colors",
    "disabled:opacity-55 disabled:cursor-not-allowed disabled:shadow-none",
    variant === "link" ? "" : SIZES[size],
    VARIANTS[variant],
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, disables the button and keeps its width. */
  loading?: boolean;
  /** Text shown while loading (defaults to the children). */
  loadingText?: ReactNode;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    loadingText,
    icon,
    iconRight,
    fullWidth,
    disabled,
    className = "",
    children,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, `${fullWidth ? "w-full" : ""} ${className}`)}
      {...rest}
    >
      {loading ? <Spinner size={size === "sm" ? 12 : 16} tone={variant === "primary" || variant === "danger" ? "light" : "dark"} /> : icon}
      {loading && loadingText ? loadingText : children}
      {!loading && iconRight}
    </button>
  );
});

export default Button;
