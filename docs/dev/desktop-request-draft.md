# Desktop Request Draft and Theme Config

Scope:
- `apps/desktop/src/App.tsx`
- `apps/desktop/src/requestDraft.ts`
- `apps/desktop/src/themeConfig.ts`
- `apps/desktop/src/views/types.ts`
- `apps/desktop/src/views/RequestWorkbenchView.tsx`
- `apps/desktop/src/views/WorkspaceSidebarView.tsx`

## Request draft model

The desktop app keeps request editing state in a single `draft` object owned by `App`.

`draft` contains:
- method
- base URL
- query/header rows
- bearer token
- body mode and payload language
- editor/file body state
- file name
- `syncParamsWithUrl`

`requestDraft.ts` is the source of truth for request-editor behavior. It provides pure helpers for:
- creating the default draft shape
- parsing request text into draft state
- rebuilding request text from draft state
- deriving the displayed URL
- syncing URL query params into row state
- adding, removing, and patching key/value rows

Keep request parsing/building logic in `requestDraft.ts`, not inline in `App`.

## Declarative view config

The desktop views use typed option arrays from `apps/desktop/src/views/types.ts` for repeated UI controls:
- panel tabs
- response tabs
- body mode options
- payload language options

The views should map these configs directly instead of hard-coding repeated JSX for each option.

## Theme source of truth

`themeConfig.ts` owns:
- theme option labels
- accent palettes
- Monaco theme names
- Monaco theme definitions

`registerMonacoThemes()` should stay data-driven by iterating the theme config instead of defining each theme inline in `App`.
