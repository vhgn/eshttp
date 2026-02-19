# Desktop Dev Commands

This repo has two root desktop development entrypoints:

- `bun dev:web` runs the desktop frontend in browser mode (Vite dev server).
- `bun dev:app` runs the Tauri desktop app in development mode.

## Why `beforeDevCommand` uses workspace filters

`apps/desktop/src-tauri/tauri.conf.json` uses:

- `"beforeDevCommand": "bun run --filter '@eshttp/desktop' dev"`
- `"beforeBuildCommand": "bun run --filter '@eshttp/desktop' build"`

Do not replace these with relative `cd .. && bun run ...` commands. The Tauri CLI launch directory is not stable across invocation styles (for example, invoking through root workspace scripts), and relative `cd` assumptions can break with `Script not found` errors.

## Why desktop Vite aliases `@eshttp/core` to source

`libs/core/package.json` exports `./dist/index.js` for publish/release workflows. In local workspace and Vercel desktop builds, that dist output may not exist yet when Vite starts.

To keep browser/desktop builds independent from a prebuild step, `apps/desktop/vite.config.ts` maps `@eshttp/core` to `../../libs/core/src/index.ts` via `resolve.alias`. Keep this alias in place unless you also change build orchestration to always build `libs/core` first in every environment.

## Desktop build script behavior

`apps/desktop/package.json` `build` intentionally does two steps:
- `bun run build:api`: compiles `apps/desktop/api/**/*.ts` to `apps/desktop/api-build/**/*.js` using `tsconfig.api.json`
- `vite build`: produces frontend static assets in `dist`

This keeps backend Vercel functions on emitted CommonJS JavaScript while the app/frontend remain on the existing Vite pipeline.

## Rust layout expectation

`apps/desktop/src-tauri/Cargo.toml` declares a `[lib]` target named `eshttp_desktop_lib`. That requires `apps/desktop/src-tauri/src/lib.rs` to exist. Keep `src/main.rs` as a thin launcher:

```rust
fn main() {
    eshttp_desktop_lib::run();
}
```

Moving app startup logic back into `src/main.rs` without a matching `lib.path` or `src/lib.rs` will break `cargo metadata` and `tauri dev`.
