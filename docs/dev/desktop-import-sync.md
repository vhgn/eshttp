# Desktop Import and Sync Model

Scope:
- `apps/desktop/src/data/collectionsRepository.ts`
- `apps/desktop/src/data/idb.ts`
- `apps/desktop/src-tauri/src/main.rs`

## Runtime modes and import records

`CollectionsRepository` uses two runtimes:
- `tauri`: imported path is stored in `ImportRecord.path`.
- `web`: imported `FileSystemDirectoryHandle` is stored in `ImportRecord.handle`.

Imports are persisted in IndexedDB (`imports` store). Cache snapshots are stored in `workspace_cache`. Pending writes are stored in `sync_queue`.

## Workspace tree model

Each import can produce:
- one `readonly` workspace (live files),
- one `editable` workspace (cached snapshot),

Both appear in `WorkspaceTreeNode[]` from `loadWorkspaceTree()`. Sync status is derived from queued ops:
- `synced`: no queued ops for the import.
- `pending`: queued ops exist.
- `error`: at least one queued op has `error`.

Each collection node now also carries `relativePath` so UI layers can render path-aware trees without parsing synthetic IDs.

IDs are synthetic and stable per import:
- workspace: `workspace:<mode>:<importId>`
- collection: `collection:<mode>:<importId>:<relativePath>`
- request: `request:<mode>:<importId>:<relativePath>:<fileName>`

## Create flow

`createWorkspace()` creates a new import record (directory picker in both runtimes) and returns the readonly workspace id.

`createCollection(workspaceId, collectionPath)`:
1. Normalizes a relative path (no empty path, no `.` / `..` segments).
2. Ensures editable cache exists for the import.
3. Adds the collection to cached workspace state.
4. Enqueues a sync write for `<collectionPath>/.env.default` with empty content.

Because collection discovery requires `.http` files, newly created collections are guaranteed to appear in editable view immediately (cache-backed), while readonly discovery will include them once request files exist on disk.

## Save flow

`saveRequestText(requestId, text)`:
1. Resolve request from in-memory indexes.
2. If request is readonly, create editable cache first (`ensureEditableWorkspace`).
3. Update cached request text in `workspace_cache`.
4. Enqueue sync op (`type: "write"`) in `sync_queue`.

Writes are asynchronous. The UI may show pending until `flushSyncQueue()` applies ops.

## Sync loop

`startSyncLoop()` runs `flushSyncQueue()` every `2_000ms`.

`flushSyncQueue()` behavior:
- Success: apply write and remove queue record.
- Failure: re-put same op with `error` message, preserving visibility of failure.

`applySyncWrite()` targets runtime-specific backends:
- `tauri`: invokes `write_text_file` command.
- `web`: requests readwrite permission and writes through File System Access API.

## Environment reads

Environment values are read by workspace/collection id:
- `readWorkspaceEnvironment(workspaceId, envName)`
- `readCollectionEnvironment(collectionId, envName)`

Lookup order is implemented by caller (`App.tsx`) via `readCombinedEnv` (`default` + selected env). Repository only returns a single `.env.<name>` text per scope.

## Import commands and backend contract

Tauri commands used by repository:
- `pick_directory`
- `discover_collections`
- `list_requests`
- `read_text_file`
- `write_text_file`
- `read_environment_file`

In web runtime, analogous behavior is implemented directly in browser APIs (`showDirectoryPicker`, directory handles, file handles).
