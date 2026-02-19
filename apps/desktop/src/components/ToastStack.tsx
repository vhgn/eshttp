import type { ToastMessage } from "../views/types";

interface ToastStackProps {
  toasts: ToastMessage[];
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function ToastStack({ toasts }: ToastStackProps) {
  return (
    <div
      className="pointer-events-none fixed right-[0.9rem] top-[0.9rem] z-30 grid gap-[0.45rem]"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "max-w-[min(80vw,420px)] rounded-tile border border-[color-mix(in_srgb,var(--stroke-default)_70%,transparent)] bg-[color-mix(in_srgb,var(--surface-secondary)_90%,#000)] px-[0.7rem] py-[0.55rem] text-[0.85rem] text-content-primary shadow-toast",
            toast.tone === "error" &&
              "border-[color-mix(in_srgb,var(--status-error)_55%,var(--stroke-default))] bg-[color-mix(in_srgb,#6b2828_24%,var(--surface-secondary))]",
          )}
        >
          {toast.text}
        </div>
      ))}
    </div>
  );
}
