# Agent Guidance for `eshttp`

Read these docs before editing matching areas:
- `docs/dev/desktop-import-sync.md`: desktop import model, readonly/editable workspaces, cache, and sync queue.
- `docs/dev/workspace-discovery.md`: workspace roots, `.eshttp.json` discovery behavior, and env file lookup.
- `docs/dev/request-build-env.md`: HTTP parsing, placeholder resolution, env merge precedence, and error model.
- `docs/dev/inline-monaco-placeholders.md`: inline Monaco language, placeholder completion rules, and env key wiring.

Required behavior for future agents:
- Validate docs against code before relying on them. If code and docs disagree, update docs in the same task.
- If a task took longer than expected because behavior was implicit or hard to discover, add/update a focused doc in `docs/dev/<name>.md`.
- When adding a new `docs/dev/<name>.md`, also add a one-line pointer in this file so later agents can find it quickly.
