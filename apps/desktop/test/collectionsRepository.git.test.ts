import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

interface TestState {
  imports: Array<Record<string, unknown>>;
  cacheByImportId: Record<string, unknown>;
  syncQueue: Array<Record<string, unknown>>;
  detectedGitRepo: string | null;
  writeCalls: Array<{ path: string; contents: string }>;
  commitCalls: Array<{ repoRoot: string; paths: string[]; message: string }>;
  failCommit: boolean;
}

const runtimeModuleId = new URL("../src/runtime.ts", import.meta.url).href;
const idbModuleId = new URL("../src/data/idb.ts", import.meta.url).href;
const repositoryModuleUrl = new URL("../src/data/collectionsRepository.ts", import.meta.url);

function createInitialState(): TestState {
  return {
    imports: [],
    cacheByImportId: {},
    syncQueue: [],
    detectedGitRepo: null,
    writeCalls: [],
    commitCalls: [],
    failCommit: false,
  };
}

let state: TestState = createInitialState();

function installModuleMocks(): void {
  mock.module(runtimeModuleId, () => {
    return {
      isTauriRuntime: () => true,
      invokeTauri: async (command: string, args?: Record<string, unknown>) => {
        if (command === "detect_git_repo") {
          return state.detectedGitRepo;
        }

        if (command === "discover_collections") {
          return [];
        }

        if (command === "list_requests") {
          return [];
        }

        if (command === "read_text_file") {
          return null;
        }

        if (command === "read_environment_file") {
          return null;
        }

        if (command === "pick_directory") {
          return null;
        }

        if (command === "write_text_file") {
          const path = String(args?.path ?? "");
          const contents = String(args?.contents ?? "");
          state.writeCalls.push({ path, contents });
          return undefined;
        }

        if (command === "git_commit_paths") {
          if (state.failCommit) {
            throw new Error("git commit failed");
          }

          state.commitCalls.push({
            repoRoot: String(args?.repoRoot ?? ""),
            paths: (args?.paths as string[]) ?? [],
            message: String(args?.message ?? ""),
          });
          return undefined;
        }

        throw new Error(`Unexpected tauri command in test: ${command}`);
      },
    };
  });

  mock.module(idbModuleId, () => {
    return {
      listImports: async () =>
        [...state.imports].sort(
          (left, right) => Number(left.createdAt ?? 0) - Number(right.createdAt ?? 0),
        ),
      putImport: async (record: Record<string, unknown>) => {
        const index = state.imports.findIndex((entry) => entry.id === record.id);
        if (index >= 0) {
          state.imports[index] = record;
        } else {
          state.imports.push(record);
        }
      },
      getImportById: async (importId: string) =>
        state.imports.find((entry) => entry.id === importId) ?? null,
      updateImportRecord: async (importId: string, patch: Record<string, unknown>) => {
        const index = state.imports.findIndex((entry) => entry.id === importId);
        if (index < 0) {
          return null;
        }

        state.imports[index] = {
          ...state.imports[index],
          ...patch,
        };
        return state.imports[index];
      },
      getCacheWorkspace: async (importId: string) => state.cacheByImportId[importId] ?? null,
      putCacheWorkspace: async (record: Record<string, unknown>) => {
        const importId = String(record.importId ?? "");
        state.cacheByImportId[importId] = record;
      },
      listSyncQueue: async () =>
        [...state.syncQueue].sort(
          (left, right) => Number(left.createdAt ?? 0) - Number(right.createdAt ?? 0),
        ),
      putSyncOp: async (record: Record<string, unknown>) => {
        const index = state.syncQueue.findIndex((entry) => entry.id === record.id);
        if (index >= 0) {
          state.syncQueue[index] = record;
        } else {
          state.syncQueue.push(record);
        }
      },
      deleteSyncOp: async (id: string) => {
        state.syncQueue = state.syncQueue.filter((entry) => entry.id !== id);
      },
    };
  });
}

async function createRepository() {
  installModuleMocks();
  const module = await import(`${repositoryModuleUrl.href}?case=${crypto.randomUUID()}`);
  return new module.CollectionsRepository();
}

describe("CollectionsRepository git storage behavior", () => {
  beforeEach(() => {
    state = createInitialState();
  });

  afterEach(() => {
    mock.restore();
  });

  test("successful git sync write appends pending git paths", async () => {
    state.imports = [
      {
        id: "import-1",
        name: "workspace",
        runtime: "tauri",
        path: "/repo/workspace",
        storageKind: "git",
        gitRepoRoot: "/repo",
        pendingGitPaths: [],
        createdAt: 1,
      },
    ];
    state.syncQueue = [
      {
        id: "sync-1",
        importId: "import-1",
        type: "write",
        relativePath: "users/list.http",
        content: "GET https://example.com/users",
        createdAt: 1,
      },
    ];

    const repository = await createRepository();
    await repository.flushSyncQueue();

    expect(state.syncQueue).toHaveLength(0);
    expect(state.writeCalls).toHaveLength(1);
    expect(state.writeCalls[0]?.path).toBe("/repo/workspace/users/list.http");
    expect(state.imports[0]?.pendingGitPaths).toEqual(["users/list.http"]);
  });

  test("direct storage sync writes do not append pending git paths", async () => {
    state.imports = [
      {
        id: "import-1",
        name: "workspace",
        runtime: "tauri",
        path: "/repo/workspace",
        storageKind: "direct",
        createdAt: 1,
      },
    ];
    state.syncQueue = [
      {
        id: "sync-1",
        importId: "import-1",
        type: "write",
        relativePath: "users/list.http",
        content: "GET https://example.com/users",
        createdAt: 1,
      },
    ];

    const repository = await createRepository();
    await repository.flushSyncQueue();

    expect(state.syncQueue).toHaveLength(0);
    expect(state.writeCalls).toHaveLength(1);
    expect(state.imports[0]?.pendingGitPaths).toBeUndefined();
  });

  test("commit clears pending paths and commits only tracked eshttp paths", async () => {
    state.imports = [
      {
        id: "import-1",
        name: "workspace",
        runtime: "tauri",
        path: "/repo/workspace",
        storageKind: "git",
        gitRepoRoot: "/repo",
        pendingGitPaths: ["users/list.http", "nested/create.http"],
        createdAt: 1,
      },
    ];

    const repository = await createRepository();
    await repository.loadWorkspaceTree();

    const result = await repository.commitWorkspaceChanges("workspace:readonly:import-1", "sync");

    expect(result.committedPaths).toBe(2);
    expect(state.imports[0]?.pendingGitPaths).toEqual([]);
    expect(state.commitCalls).toHaveLength(1);
    expect(state.commitCalls[0]).toEqual({
      repoRoot: "/repo",
      paths: ["workspace/users/list.http", "workspace/nested/create.http"],
      message: "sync",
    });
  });

  test("commit failure keeps pending tracked paths", async () => {
    state.imports = [
      {
        id: "import-1",
        name: "workspace",
        runtime: "tauri",
        path: "/repo/workspace",
        storageKind: "git",
        gitRepoRoot: "/repo",
        pendingGitPaths: ["users/list.http"],
        createdAt: 1,
      },
    ];
    state.failCommit = true;

    const repository = await createRepository();
    await repository.loadWorkspaceTree();

    await expect(
      repository.commitWorkspaceChanges("workspace:readonly:import-1", "sync"),
    ).rejects.toThrow("git commit failed");
    expect(state.imports[0]?.pendingGitPaths).toEqual(["users/list.http"]);
  });

  test("tauri imports without storage kind are backfilled on load", async () => {
    state.imports = [
      {
        id: "import-1",
        name: "workspace",
        runtime: "tauri",
        path: "/repo/workspace",
        createdAt: 1,
      },
    ];
    state.detectedGitRepo = "/repo";

    const repository = await createRepository();
    await repository.loadWorkspaceTree();

    expect(state.imports[0]?.storageKind).toBe("git");
    expect(state.imports[0]?.gitRepoRoot).toBe("/repo");
  });
});
