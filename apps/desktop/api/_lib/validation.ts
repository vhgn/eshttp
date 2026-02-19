import { normalizeRelativePath } from "./security";

export interface CommitPayload {
  owner: string;
  repo: string;
  branch: string;
  workspacePath: string;
  message: string;
  files: Record<string, string>;
}

const OWNER_REPO_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/;
const BRANCH_PATTERN = /^[A-Za-z0-9._/-]{1,255}$/;
const MESSAGE_MAX = 200;
const FILE_COUNT_MAX = 100;
const FILE_BYTES_MAX = 200_000;
const TOTAL_BYTES_MAX = 2_000_000;
const FILE_PATH_PATTERN = /^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/;

function asString(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

function normalizeWorkspacePath(value: string): string | null {
  const normalized = normalizeRelativePath(value);
  if (!normalized || normalized === ".") {
    return null;
  }

  return normalized;
}

function normalizeCommitFilePath(value: string): string | null {
  const normalized = normalizeRelativePath(value);
  if (!normalized || normalized === ".") {
    return null;
  }

  if (!FILE_PATH_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}

export function validateCommitPayload(value: unknown): CommitPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const target = value as Record<string, unknown>;

  const owner = asString(target.owner);
  const repo = asString(target.repo);
  const branch = asString(target.branch);
  const workspacePath = asString(target.workspacePath);
  const message = asString(target.message);

  if (!owner || !OWNER_REPO_PATTERN.test(owner)) {
    return null;
  }

  if (!repo || !OWNER_REPO_PATTERN.test(repo)) {
    return null;
  }

  if (!branch || !BRANCH_PATTERN.test(branch) || branch.includes("..") || branch.startsWith("/")) {
    return null;
  }

  if (!workspacePath) {
    return null;
  }

  const normalizedWorkspacePath = normalizeWorkspacePath(workspacePath);
  if (!normalizedWorkspacePath) {
    return null;
  }

  if (!message || message.length > MESSAGE_MAX) {
    return null;
  }

  if (!target.files || typeof target.files !== "object" || Array.isArray(target.files)) {
    return null;
  }

  const files: Record<string, string> = {};
  const entries = Object.entries(target.files as Record<string, unknown>);
  if (entries.length === 0 || entries.length > FILE_COUNT_MAX) {
    return null;
  }

  let totalBytes = 0;
  for (const [rawPath, rawContent] of entries) {
    const normalizedPath = normalizeCommitFilePath(rawPath);
    if (!normalizedPath) {
      return null;
    }

    if (typeof rawContent !== "string") {
      return null;
    }

    const fileBytes = Buffer.byteLength(rawContent, "utf8");
    if (fileBytes > FILE_BYTES_MAX) {
      return null;
    }

    totalBytes += fileBytes;
    if (totalBytes > TOTAL_BYTES_MAX) {
      return null;
    }

    files[normalizedPath] = rawContent;
  }

  return {
    owner,
    repo,
    branch,
    workspacePath: normalizedWorkspacePath,
    message,
    files,
  };
}
