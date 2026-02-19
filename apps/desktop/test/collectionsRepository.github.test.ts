import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

interface TestState {
  imports: Array<Record<string, unknown>>;
  cacheByImportId: Record<string, unknown>;
  syncQueue: Array<Record<string, unknown>>;
}

const runtimeModuleId = new URL("../src/runtime.ts", import.meta.url).href;
const idbModuleId = new URL("../src/data/idb.ts", import.meta.url).href;
const repositoryModuleUrl = new URL("../src/data/collectionsRepository.ts", import.meta.url);

let state: TestState;

function createInitialState(): TestState {
  return {
    imports: [],
    cacheByImportId: {},
    syncQueue: [],
  };
}

function installModuleMocks(): void {
  mock.module(runtimeModuleId, () => {
    return {
      isTauriRuntime: () => false,
      invokeTauri: async (command: string) => {
        throw new Error(`Unexpected tauri command in web github test: ${command}`);
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

describe("CollectionsRepository github storage behavior", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    state = createInitialState();
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mock.restore();
  });

  test("importGitHubWorkspaces requires auth when backend responds 401", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
      })) as unknown as typeof fetch;

    const repository = await createRepository();
    const result = await repository.importGitHubWorkspaces();

    expect(result.requiresAuth).toBe(true);
    expect(result.imported).toBe(0);
  });

  test("importGitHubWorkspaces imports snapshots into github-backed cache", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          workspaces: [
            {
              owner: "octocat",
              repo: "hello-world",
              branch: "main",
              workspacePath: ".eshttp/workspaces/demo",
              workspaceName: "demo",
              collections: [
                {
                  relativePath: "users",
                  name: "users",
                  iconSvg: null,
                  requests: [
                    {
                      fileName: "list.http",
                      title: "list",
                      text: "GET https://example.com/users",
                    },
                  ],
                },
              ],
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      )) as unknown as typeof fetch;

    const repository = await createRepository();
    const result = await repository.importGitHubWorkspaces();

    expect(result.imported).toBe(1);
    expect(state.imports).toHaveLength(1);
    expect(state.imports[0]?.storageKind).toBe("github");
    expect(state.imports[0]?.githubRepo).toBe("hello-world");

    const cache = Object.values(state.cacheByImportId)[0] as { collections: unknown[] };
    expect(cache.collections).toHaveLength(1);
  });

  test("saving and committing github-backed requests uses backend commit endpoint", async () => {
    state.imports = [
      {
        id: "import-1",
        name: "octocat/hello-world:demo",
        runtime: "web",
        storage: "indexeddb",
        storageKind: "github",
        githubOwner: "octocat",
        githubRepo: "hello-world",
        githubBranch: "main",
        githubWorkspacePath: ".eshttp/workspaces/demo",
        pendingGitPaths: [],
        pendingGitFileContents: {},
        createdAt: 1,
      },
    ];
    state.cacheByImportId["import-1"] = {
      importId: "import-1",
      rootName: "demo",
      collections: [
        {
          relativePath: "users",
          name: "users",
          iconSvg: null,
          requests: [
            {
              fileName: "list.http",
              title: "list",
              text: "GET https://example.com/users",
            },
          ],
        },
      ],
    };

    const commitPayload: {
      value: {
        owner: string;
        repo: string;
        files: Record<string, string>;
      } | null;
    } = {
      value: null,
    };
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/github/commit") {
        commitPayload.value = JSON.parse(String(init?.body ?? "{}")) as {
          owner: string;
          repo: string;
          files: Record<string, string>;
        };
        return new Response(JSON.stringify({ committedFiles: 1, commitSha: "abc123" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      throw new Error(`Unexpected fetch input: ${String(input)}`);
    }) as unknown as typeof fetch;

    const repository = await createRepository();
    await repository.loadWorkspaceTree();

    await repository.saveRequestText(
      "request:editable:import-1:users:list.http",
      "GET https://example.com/users?page=2",
    );

    const commit = await repository.commitWorkspaceChanges("workspace:editable:import-1", "sync");
    expect(commit.committedPaths).toBe(1);

    expect(commitPayload.value).not.toBeNull();
    if (!commitPayload.value) {
      throw new Error("Missing commit payload");
    }

    expect(commitPayload.value.owner).toBe("octocat");
    expect(commitPayload.value.repo).toBe("hello-world");
    expect(commitPayload.value.files["users/list.http"]).toContain("page=2");

    expect(state.imports[0]?.pendingGitPaths).toEqual([]);
    expect(state.imports[0]?.pendingGitFileContents).toEqual({});
  });
});
