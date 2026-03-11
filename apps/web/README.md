# eshttp Web

Static TanStack Start landing page for `eshttp`.

## Local development

```bash
bun install
bun run dev:web
```

Or from this directory:

```bash
bun --bun run dev
```

## Build

```bash
bun --bun run build
```

The build emits prerendered landing assets to `dist/client`.

## Vercel

When deploying `apps/web` on Vercel:

- Root Directory: `apps/web`
- Build Command: `bun --bun run build`
- Output Directory: `dist/client`
