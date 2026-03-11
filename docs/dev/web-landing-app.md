# Web Landing App

Scope:
- `apps/web`
- root `package.json` web scripts

## Root commands

The repo now has a dedicated landing app entrypoint:

- `bun dev:web` runs the TanStack Start landing page in `apps/web`
- `bun dev:landing` is an alias for the same app

Desktop browser mode moved to:

- `bun dev:desktop:web`

Keep these names aligned with the actual app targets. `dev:web` should refer to the landing app, not the desktop Vite shell.

## Build output

`apps/web` uses TanStack Start with prerendering enabled in `apps/web/vite.config.ts`.

The production build still emits both:
- `dist/client`
- `dist/server`

For the landing page deployment, Vercel should publish the prerendered static client output from `dist/client`.

## Prerender contract

`apps/web/vite.config.ts` explicitly prerenders `/`:

- `prerender.enabled: true`
- `pages: [{ path: "/", prerender: { enabled: true, crawlLinks: false } }]`

This keeps the landing page fully static while still using TanStack Start.
