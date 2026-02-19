import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "accent" | "secondary" | "danger" | "tab" | "ghost";
type ButtonSize = "md" | "compact" | "sm" | "xs" | "icon" | "none";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const baseClass =
  "inline-flex items-center justify-center border font-inherit transition-[background-color,border-color,color,box-shadow] duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_color-mix(in_srgb,var(--stroke-accent)_42%,transparent)]";

const variantClassByName: Record<ButtonVariant, string> = {
  primary:
    "border-[color-mix(in_srgb,var(--stroke-accent)_55%,var(--stroke-default))] bg-stroke-accent text-content-on-accent hover:bg-[color-mix(in_srgb,var(--stroke-accent)_88%,var(--surface-tertiary))]",
  accent:
    "border-[color-mix(in_srgb,var(--stroke-accent)_50%,var(--stroke-default))] bg-[color-mix(in_srgb,var(--stroke-accent)_18%,var(--surface-tertiary))] text-content-primary hover:border-[color-mix(in_srgb,var(--stroke-accent)_64%,var(--stroke-default))] hover:bg-[color-mix(in_srgb,var(--stroke-accent)_26%,var(--surface-tertiary))]",
  secondary:
    "border-stroke-default bg-surface-secondary text-content-primary hover:border-[color-mix(in_srgb,var(--stroke-accent)_35%,var(--stroke-default))] hover:bg-surface-tertiary",
  danger:
    "border-stroke-default bg-[color-mix(in_srgb,var(--state-danger)_40%,var(--surface-secondary))] text-content-primary hover:border-[color-mix(in_srgb,var(--state-danger)_62%,var(--stroke-default))] hover:bg-[color-mix(in_srgb,var(--state-danger)_52%,var(--surface-secondary))]",
  tab: "border-stroke-default bg-transparent text-content-primary hover:bg-surface-tertiary",
  ghost:
    "border-[color-mix(in_srgb,var(--stroke-default)_90%,transparent)] bg-transparent text-content-primary hover:border-[color-mix(in_srgb,var(--stroke-accent)_36%,var(--stroke-default))] hover:bg-surface-tertiary",
};

const sizeClassByName: Record<ButtonSize, string> = {
  md: "rounded-control px-[0.55rem] py-[0.45rem]",
  compact: "rounded-control px-[0.62rem] py-[0.38rem]",
  sm: "rounded-[7px] px-[0.4rem] py-[0.34rem] text-[0.76rem]",
  xs: "rounded-[6px] px-[0.4rem] py-[0.2rem] text-[0.72rem]",
  icon: "h-[42px] w-[42px] rounded-panel p-0 text-[1.35rem] leading-none",
  none: "",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(baseClass, variantClassByName[variant], sizeClassByName[size], className)}
      {...props}
    />
  );
}
