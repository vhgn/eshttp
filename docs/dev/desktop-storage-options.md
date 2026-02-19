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
- `kind: "direct" | "git" | "github"`
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
  - save: invokes `write_text_file`
  - commit: unsupported
- `TauriGitStorageOption`
  - save check: imported path + git repo root metadata present
  - save: invokes `write_text_file`
  - commit check: same metadata guards
  - commit: invokes `git_commit_paths`
- `WebGitHubStorageOption`
  - save check/save: unsupported (web edits are kept in cache and staged for backend commit)
  - commit check: requires GitHub repo metadata + pending file contents
  - commit: POST `/api/github/commit` with workspace metadata and pending file map
  - surfaces `GITHUB_REAUTH_REQUIRED` when backend demands write scope escalation

## Import metadata

`ImportRecord` now persists storage state:
- `storageKind?: "direct" | "git" | "github"`
- `gitRepoRoot?: string`
- `pendingGitPaths?: string[]`
- `pendingGitFileContents?: Record<string, string>` (github mode)
- `githubOwner?`, `githubRepo?`, `githubBranch?`, `githubWorkspacePath?` (github mode)

Backfill behavior:
- Existing Tauri imports without `storageKind` are detected once on tree load and persisted.

## Save and sync behavior

`flushSyncQueue()`:
1. Resolves import + storage option.
2. Runs `checkSave`.
3. Runs `save`.
4. If storage kind is `git`, appends written relative path to `pendingGitPaths` (deduped).

For github-backed imports (`storage: indexeddb`, `storageKind: "github"`):
- saves do not enqueue filesystem sync ops
- edited file content is tracked in `pendingGitFileContents`
- tracked paths are tracked in `pendingGitPaths`
- commit later pushes these tracked files through backend API

`Save` remains non-committing in all modes.

## Commit behavior

Workspace-level commit action calls `commitWorkspaceChanges(workspaceId, message?)`:
1. Ensures workspace storage supports commit (`git` or `github`).
2. Flushes sync queue.
3. Blocks commit if sync queue still has pending/error ops.
4. Uses only `pendingGitPaths` tracked by eshttp.
5. Uses default message when empty: `chore(eshttp): sync workspace changes`.
6. For tauri git: converts workspace-relative paths to repo-relative and calls `git_commit_paths`.
7. For web github: uses `pendingGitFileContents` and calls backend `/api/github/commit`.
8. Clears pending path/content state on success.

Web runtime can expose commit flow for github-backed imports.

## Tauri command contract

- `detect_git_repo(path)`:
  - uses `git -C <path> rev-parse --show-toplevel`
  - returns `null` when path is not in a repo
- `git_commit_paths(repo_root, paths, message)`:
  - sanitizes/dedupes relative paths
  - `git add -- <paths...>`
  - no-op success when staged diff for those paths is empty
  - `git commit -m <message> -- <paths...>`
