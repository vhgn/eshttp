# Desktop Tailwind Primitives

Scope:
- `apps/desktop/src/styles.css`
- `apps/desktop/src/App.tsx`
- `apps/desktop/src/components/InlineMonacoInput.tsx`
- `apps/desktop/vite.config.ts`

## Tailwind v4 setup

Desktop uses Tailwind v4 through the Vite plugin:
- `@tailwindcss/vite` in `apps/desktop/vite.config.ts`
- `@import "tailwindcss";` in `apps/desktop/src/styles.css`

## Theme source of truth

Theme values remain CSS variables on `.app-shell`:
- default block: `.app-shell`
- overrides: `.app-shell[data-theme="light"]`, `.app-shell[data-theme="soft"]`, `.app-shell[data-theme="gruvbox"]`

Update theme colors by changing those CSS variables, not JSX class names.

## Primitive naming and usage

`apps/desktop/src/styles.css` maps CSS variables to Tailwind primitives via `@theme inline`.

Primary primitives:
- Surfaces: `bg-canvas`, `bg-surface-primary`, `bg-surface-secondary`, `bg-surface-tertiary`, `bg-surface-active`
- Content: `text-content-primary`, `text-content-muted`, `text-content-on-accent`
- Borders: `border-stroke-default`, `border-stroke-accent`
- State/status: `text-status-error`, `bg-status-success`, `bg-status-warning`, `bg-status-error`, `bg-state-danger`

Shared non-color primitives:
- Typography: `font-sans`, `font-mono`
- Radius: `rounded-control`, `rounded-panel`, `rounded-pill`, `rounded-tile`
- Shadow: `shadow-toast`

## Rule: no raw palette utility classes for app chrome

For app surfaces, text, and borders:
- use semantic primitives (for example `bg-surface-secondary`, `text-content-muted`, `border-stroke-default`)
- do not use direct palette utilities such as `bg-gray-100`, `text-zinc-400`, `border-neutral-700`

Arbitrary values are acceptable for:
- gradients and `color-mix(...)`
- one-off effects that still reference semantic CSS variables

## Inline Monaco styling

`InlineMonacoInput` is utility-first and uses:
- `.inline-monaco-root` as a stable wrapper hook
- Tailwind classes for shell styling
- minimal global CSS in `styles.css` only for Monaco internal elements that cannot be targeted reliably via utilities
