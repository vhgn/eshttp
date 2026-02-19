import { invokeTauri } from "../runtime";
import type { ImportRecord } from "./idb";

export type StorageKind = "direct" | "git" | "github";

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
  files?: Record<string, string>;
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

function joinFsPath(base: string, ...parts: string[]): string {
  let output = base.replace(/[\\/]+$/, "");
  for (const part of parts) {
    if (!part || part === ".") {
      continue;
    }

    output = `${output}/${part.replace(/^[/\\]+/, "")}`;
  }

  return output;
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

async function commitToGitHubBackend(input: CommitInput): Promise<void> {
  const owner = input.importRecord.githubOwner;
  const repo = input.importRecord.githubRepo;
  const branch = input.importRecord.githubBranch;
  const workspacePath = input.importRecord.githubWorkspacePath;

  if (!owner || !repo || !branch || !workspacePath) {
    throw new Error("GitHub workspace metadata is incomplete.");
  }

  if (!input.files || Object.keys(input.files).length === 0) {
    throw new Error("No pending file contents were provided for GitHub commit.");
  }

  const response = await fetch("/api/github/commit", {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      owner,
      repo,
      branch,
      workspacePath,
      message: input.message,
      files: input.files,
    }),
  });

  const body = (await response.json().catch(() => null)) as {
    error?: string;
    reauthUrl?: string;
  } | null;

  if (!response.ok) {
    if (response.status === 403 && body?.error === "WRITE_SCOPE_REQUIRED" && body.reauthUrl) {
      const error = new Error("GitHub write access is required. Reauthentication is needed.");
      (
        error as Error & {
          code?: string;
          reauthUrl?: string;
        }
      ).code = "GITHUB_REAUTH_REQUIRED";
      (
        error as Error & {
          code?: string;
          reauthUrl?: string;
        }
      ).reauthUrl = body.reauthUrl;
      throw error;
    }

    throw new Error(body?.error || `GitHub commit failed with status ${response.status}`);
  }
}

function createWebGitHubStorageOption(): WorkspaceStorageOption {
  return {
    kind: "github",
    supportsCommit: true,
    async checkSave() {
      return {
        ok: false,
        reason: "GitHub storage writes are tracked in cache and committed in batch.",
      };
    },
    async save() {
      throw new Error("GitHub storage does not support direct file sync writes.");
    },
    async checkCommit(input) {
      if (!input.importRecord.githubOwner || !input.importRecord.githubRepo) {
        return {
          ok: false,
          reason: "GitHub repository metadata is missing for imported workspace",
        };
      }

      if (!input.importRecord.githubBranch || !input.importRecord.githubWorkspacePath) {
        return { ok: false, reason: "GitHub branch or workspace path metadata is missing" };
      }

      if (!input.files || Object.keys(input.files).length === 0) {
        return { ok: false, reason: "No pending file content found for commit" };
      }

      return { ok: true };
    },
    async commit(input) {
      await commitToGitHubBackend(input);
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

      const target = joinFsPath(input.importRecord.path, input.relativePath);
      await invoke<void>("write_text_file", {
        path: target,
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

      const target = joinFsPath(input.importRecord.path, input.relativePath);
      await invoke<void>("write_text_file", {
        path: target,
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
    if (importRecord.storageKind === "github") {
      return createWebGitHubStorageOption();
    }

    return createWebDirectStorageOption();
  }

  const invoke = dependencies.invoke ?? invokeTauri;
  if (importRecord.storageKind === "git") {
    return createTauriGitStorageOption(invoke);
  }

  return createTauriDirectStorageOption(invoke);
}
