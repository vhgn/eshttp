# Desktop Storage Options

Scope:
- `apps/desktop/src/data/storageOptions.ts`
- `apps/desktop/src/data/collectionsRepository.ts`
- `apps/desktop/src/data/idb.ts`
- `apps/desktop/src-tauri/src/lib.rs`

## Why this exists

Desktop saves now route through storage strategy interfaces instead of runtime branching inside repository methods.
This keeps save and commit behavior explicit and testable across runtimes.

## Interface contract

`WorkspaceStorageOption` defines:
- `kind: "direct" | "git"`
- `supportsCommit: boolean`
- `checkSave(input)` -> `{ ok: true } | { ok: false, reason }`
- `save(input)`
- `checkCommit(input)` (git-capable options)
- `commit(input)` (git-capable options)

`resolveStorageOption(importRecord)` selects implementation by runtime + persisted storage metadata.

## Implementations

- `WebDirectStorageOption`
  - save check: File System Access read/write permission
  - save: writes with directory/file handles
  - commit: unsupported
- `TauriDirectStorageOption`
  - save check: imported path exists in metadata
  - save: invokes `write_scoped_text_file(root, relativePath, contents)`
  - commit: unsupported
- `TauriGitStorageOption`
  - save check: imported path + git repo root metadata present
  - save: invokes `write_scoped_text_file(root, relativePath, contents)`
  - commit check: same metadata guards
  - commit: invokes `git_commit_paths`

## Import metadata

`ImportRecord` now persists storage state:
- `storageKind?: "direct" | "git"`
- `gitRepoRoot?: string`
- `pendingGitPaths?: string[]`

Backfill behavior:
- Existing Tauri imports without `storageKind` are detected once on tree load and persisted.

## Save and sync behavior

`flushSyncQueue()`:
1. Resolves import + storage option.
2. Runs `checkSave`.
3. Runs `save`.
4. If storage kind is `git`, appends written relative path to `pendingGitPaths` (deduped).

`Save` remains a file-write operation and does not auto-commit.

## Git commit behavior (Tauri only)

Workspace-level commit action calls `commitWorkspaceChanges(workspaceId, message?)`:
1. Ensures workspace storage supports commit (`git` only).
2. Flushes sync queue.
3. Blocks commit if sync queue still has pending/error ops.
4. Uses only `pendingGitPaths` tracked by eshttp.
5. Uses default message when empty: `chore(eshttp): sync workspace changes`.
6. Calls `git_commit_paths` and clears `pendingGitPaths` on success.

Web runtime never exposes or runs git commit flow.

## Tauri command contract

- `detect_git_repo(path)`:
  - uses `git -C <path> rev-parse --show-toplevel`
  - returns `null` when path is not in a repo
- `git_commit_paths(repo_root, paths, message)`:
  - sanitizes/dedupes relative paths
  - converts each path to a literal pathspec (`:(literal)<path>`)
  - `git add -- <literal-paths...>`
  - no-op success when staged diff for those paths is empty
  - `git commit -m <message> --no-verify -- <literal-paths...>` (hooks disabled)

## Scoped file safety checks

Tauri file writes and reads now use scoped commands:
- `read_scoped_text_file(root, relativePath)`
- `write_scoped_text_file(root, relativePath, contents)`

Backend guarantees for scoped commands:
- rejects empty/absolute/parent (`..`) relative paths
- resolves symlinks and rejects paths that escape `root`
- rejects writes through symlinked parent directories
- rejects non-file read/write targets
