import { invokeTauri } from "../runtime";
import type { ImportRecord } from "./idb";

export type StorageKind = "direct" | "git";

export type SaveCheckResult = { ok: true } | { ok: false; reason: string };
export type CommitCheckResult = { ok: true } | { ok: false; reason: string };

export interface SaveInput {
  importRecord: ImportRecord;
  relativePath: string;
  content: string;
}

export interface CommitInput {
  importRecord: ImportRecord;
  paths: string[];
  message: string;
}

export interface WorkspaceStorageOption {
  kind: StorageKind;
  supportsCommit: boolean;
  checkSave(input: SaveInput): Promise<SaveCheckResult>;
  save(input: SaveInput): Promise<void>;
  checkCommit?: (input: CommitInput) => Promise<CommitCheckResult>;
  commit?: (input: CommitInput) => Promise<void>;
}

type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

interface StorageOptionDependencies {
  invoke?: TauriInvoke;
}

type WebPermissionDescriptor = {
  mode?: "read" | "readwrite";
};

type WebDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor: WebPermissionDescriptor) => Promise<PermissionState>;
  requestPermission?: (descriptor: WebPermissionDescriptor) => Promise<PermissionState>;
};

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

export async function ensureReadWritePermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  const target = handle as WebDirectoryHandle;
  const readWriteDescriptor: WebPermissionDescriptor = { mode: "readwrite" };
  if (!target.queryPermission || !target.requestPermission) {
    return true;
  }

  const readPermission = await target.queryPermission(readWriteDescriptor);
  if (readPermission === "granted") {
    return true;
  }

  const granted = await target.requestPermission(readWriteDescriptor);
  return granted === "granted";
}

export async function writeFileToHandle(
  root: FileSystemDirectoryHandle,
  relativePathValue: string,
  content: string,
): Promise<void> {
  const segments = normalizePath(relativePathValue).split("/").filter(Boolean);
  const fileName = segments.pop();
  if (!fileName) {
    throw new Error("Invalid target path");
  }

  let current = root;
  for (const segment of segments) {
    current = await current.getDirectoryHandle(segment, { create: true });
  }

  const fileHandle = await current.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

function createWebDirectStorageOption(): WorkspaceStorageOption {
  return {
    kind: "direct",
    supportsCommit: false,
    async checkSave(input) {
      if (!input.importRecord.handle) {
        return { ok: false, reason: "Imported web directory handle is missing" };
      }

      const allowed = await ensureReadWritePermission(input.importRecord.handle);
      if (!allowed) {
        return { ok: false, reason: "No write permission for selected directory" };
      }

      return { ok: true };
    },
    async save(input) {
      if (!input.importRecord.handle) {
        throw new Error("Imported web directory handle is missing");
      }

      await writeFileToHandle(input.importRecord.handle, input.relativePath, input.content);
    },
  };
}

function createTauriDirectStorageOption(invoke: TauriInvoke): WorkspaceStorageOption {
  return {
    kind: "direct",
    supportsCommit: false,
    async checkSave(input) {
      if (!input.importRecord.path) {
        return { ok: false, reason: "Imported path is missing for tauri workspace" };
      }

      return { ok: true };
    },
    async save(input) {
      if (!input.importRecord.path) {
        throw new Error("Imported path is missing for tauri workspace");
      }

      await invoke<void>("write_scoped_text_file", {
        root: input.importRecord.path,
        relativePath: input.relativePath,
        contents: input.content,
      });
    },
  };
}

function createTauriGitStorageOption(invoke: TauriInvoke): WorkspaceStorageOption {
  return {
    kind: "git",
    supportsCommit: true,
    async checkSave(input) {
      if (!input.importRecord.path) {
        return { ok: false, reason: "Imported path is missing for tauri workspace" };
      }

      if (!input.importRecord.gitRepoRoot) {
        return { ok: false, reason: "Git repository root is missing for imported workspace" };
      }

      return { ok: true };
    },
    async save(input) {
      if (!input.importRecord.path) {
        throw new Error("Imported path is missing for tauri workspace");
      }

      await invoke<void>("write_scoped_text_file", {
        root: input.importRecord.path,
        relativePath: input.relativePath,
        contents: input.content,
      });
    },
    async checkCommit(input) {
      if (!input.importRecord.gitRepoRoot) {
        return { ok: false, reason: "Git repository root is missing for imported workspace" };
      }

      if (!input.importRecord.path) {
        return { ok: false, reason: "Imported path is missing for tauri workspace" };
      }

      return { ok: true };
    },
    async commit(input) {
      if (!input.importRecord.gitRepoRoot) {
        throw new Error("Git repository root is missing for imported workspace");
      }

      await invoke<void>("git_commit_paths", {
        repoRoot: input.importRecord.gitRepoRoot,
        paths: input.paths,
        message: input.message,
      });
    },
  };
}

export function resolveStorageOption(
  importRecord: ImportRecord,
  dependencies: StorageOptionDependencies = {},
): WorkspaceStorageOption {
  if (importRecord.runtime === "web") {
    return createWebDirectStorageOption();
  }

  const invoke = dependencies.invoke ?? invokeTauri;
  if (importRecord.storageKind === "git") {
    return createTauriGitStorageOption(invoke);
  }

  return createTauriDirectStorageOption(invoke);
}
