# Workspace Discovery and File Layout

Scope:
- `apps/cli/src/localSource.ts`
- `libs/core/src/config.ts`
- `apps/desktop/src-tauri/src/lib.rs`

## Workspace roots

CLI local source checks both roots:
- `<cwd>/.eshttp/workspaces`
- user config directory + `/eshttp/workspaces`

User config base:
- macOS: `~/Library/Application Support`
- Windows: `%APPDATA%` (fallback `~/AppData/Roaming`)
- Linux: `$XDG_CONFIG_HOME` (fallback `~/.config`)

Tauri backend mirrors this concept with:
- `<current_dir>/.eshttp/workspaces`
- `dirs::config_dir()/eshttp/workspaces`

## Collection discovery rule

A directory becomes a collection if it contains at least one `.http` file.

Discovery recurses through subdirectories. Collections and requests are sorted by name/title before returning.

## `.eshttp.json` behavior

Supported keys:
- `entries: string[]`
- `include: string[]`
- `exclude: string[]`

Behavior in CLI/core:
- `exclude` always removes matches.
- If `include` is empty, include-all (unless excluded).
- If `include` is non-empty, path must match at least one include pattern.
- A local `.eshttp.json` overrides the active config origin for deeper traversal.
- `entries` decides whether a directory with `.http` files is emitted as a collection.
- `entries` match is evaluated relative to the config origin directory.

Core helper mapping:
- parse config: `parseDiscoveryConfig()`
- include/exclude check: `pathIncludedByConfig()`
- entries evaluation: `matchesEntryPattern()`

Tauri implements equivalent behavior with `glob::Pattern` (`path_included`, `matches_entries`).

## Environment file layout

Environment files are plain text:
- workspace: `<workspace>/.env.<name>`
- collection: `<collection>/.env.<name>`

Reading defaults:
- `default` env is not implicit in `readEnvironmentFile`; caller composes it by reading `.env.default` first.
