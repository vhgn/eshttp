import { describe, expect, mock, test } from "bun:test";
import type { ImportRecord } from "../src/data/idb";
import { resolveStorageOption } from "../src/data/storageOptions";

function makeImport(partial: Partial<ImportRecord>): ImportRecord {
  return {
    id: partial.id ?? "import-1",
    name: partial.name ?? "workspace",
    runtime: partial.runtime ?? "web",
    createdAt: partial.createdAt ?? 0,
    path: partial.path,
    handle: partial.handle,
    storageKind: partial.storageKind,
    gitRepoRoot: partial.gitRepoRoot,
    pendingGitPaths: partial.pendingGitPaths,
  };
}

const invokeStub = async <T>() => undefined as T;

describe("storage options", () => {
  test("resolves web imports to direct storage", () => {
    const option = resolveStorageOption(
      makeImport({
        runtime: "web",
        handle: {} as FileSystemDirectoryHandle,
      }),
    );

    expect(option.kind).toBe("direct");
    expect(option.supportsCommit).toBe(false);
  });

  test("resolves tauri direct imports to direct storage", () => {
    const option = resolveStorageOption(
      makeImport({
        runtime: "tauri",
        path: "/tmp/project",
        storageKind: "direct",
      }),
      {
        invoke: invokeStub,
      },
    );

    expect(option.kind).toBe("direct");
    expect(option.supportsCommit).toBe(false);
  });

  test("resolves tauri git imports to git storage", () => {
    const option = resolveStorageOption(
      makeImport({
        runtime: "tauri",
        path: "/tmp/project",
        storageKind: "git",
        gitRepoRoot: "/tmp/project",
      }),
      {
        invoke: invokeStub,
      },
    );

    expect(option.kind).toBe("git");
    expect(option.supportsCommit).toBe(true);
  });

  test("web save check fails when readwrite permission is denied", async () => {
    const deniedHandle = {
      queryPermission: async () => "denied" as PermissionState,
      requestPermission: async () => "denied" as PermissionState,
    } as unknown as FileSystemDirectoryHandle;

    const option = resolveStorageOption(
      makeImport({
        runtime: "web",
        handle: deniedHandle,
      }),
    );

    const check = await option.checkSave({
      importRecord: makeImport({
        runtime: "web",
        handle: deniedHandle,
      }),
      relativePath: "users/list.http",
      content: "GET https://example.com",
    });

    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.reason).toContain("No write permission");
    }
  });

  test("tauri git save check fails when repo metadata is missing", async () => {
    const option = resolveStorageOption(
      makeImport({
        runtime: "tauri",
        path: "/tmp/project",
        storageKind: "git",
      }),
      {
        invoke: invokeStub,
      },
    );

    const check = await option.checkSave({
      importRecord: makeImport({
        runtime: "tauri",
        path: "/tmp/project",
        storageKind: "git",
      }),
      relativePath: "users/list.http",
      content: "GET https://example.com",
    });

    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.reason).toContain("Git repository root is missing");
    }
  });

  test("tauri direct save uses scoped write command with relative path", async () => {
    const invoke = mock(async (_command: string, _args?: Record<string, unknown>) => {
      return undefined;
    }) as unknown as <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
    const importRecord = makeImport({
      runtime: "tauri",
      path: "/tmp/project",
      storageKind: "direct",
    });
    const option = resolveStorageOption(importRecord, { invoke });

    await option.save({
      importRecord,
      relativePath: "users/list.http",
      content: "GET https://example.com",
    });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("write_scoped_text_file", {
      root: "/tmp/project",
      relativePath: "users/list.http",
      contents: "GET https://example.com",
    });
  });
});
