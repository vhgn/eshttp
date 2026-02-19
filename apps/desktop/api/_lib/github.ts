import { joinRepoPath, normalizeRelativePath } from "./security";

const GITHUB_API_ORIGIN = "https://api.github.com";

export interface GitHubTokenResponse {
  accessToken: string;
  scopes: string[];
}

export interface GitHubUser {
  id: string;
  login: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  owner: {
    login: string;
  };
  default_branch: string;
  private: boolean;
}

interface GitTreeEntry {
  path: string;
  mode: string;
  type: "blob" | "tree" | string;
  sha: string;
  size?: number;
}

interface GitTreeResponse {
  sha: string;
  truncated: boolean;
  tree: GitTreeEntry[];
}

interface WorkspaceRequestSnapshot {
  fileName: string;
  title: string;
  text: string;
}

interface WorkspaceCollectionSnapshot {
  relativePath: string;
  name: string;
  iconSvg: string | null;
  requests: WorkspaceRequestSnapshot[];
}

export interface WorkspaceSnapshot {
  owner: string;
  repo: string;
  branch: string;
  workspacePath: string;
  workspaceName: string;
  collections: WorkspaceCollectionSnapshot[];
}

export interface CommitWorkspaceInput {
  owner: string;
  repo: string;
  branch: string;
  workspacePath: string;
  message: string;
  files: Record<string, string>;
}

interface RefResponse {
  object: {
    sha: string;
  };
}

interface CommitResponse {
  sha: string;
  tree: {
    sha: string;
  };
}

function parseScopeList(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ).sort();
}

function parseTitleFromFileName(fileName: string): string {
  return fileName.endsWith(".http") ? fileName.slice(0, -".http".length) : fileName;
}

function dirname(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  if (index < 0) {
    return ".";
  }

  const value = normalized.slice(0, index);
  return value.length === 0 ? "." : value;
}

function basename(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  if (index < 0) {
    return normalized;
  }

  return normalized.slice(index + 1);
}

async function githubRequest<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${GITHUB_API_ORIGIN}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API request failed (${response.status}): ${body.slice(0, 300)}`);
  }

  return (await response.json()) as T;
}

async function fetchBlobText(
  accessToken: string,
  owner: string,
  repo: string,
  sha: string,
): Promise<string> {
  const blob = await githubRequest<{ content: string; encoding: string }>(
    accessToken,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs/${encodeURIComponent(sha)}`,
  );

  if (blob.encoding !== "base64") {
    throw new Error(`Unsupported blob encoding: ${blob.encoding}`);
  }

  return Buffer.from(blob.content.replace(/\n/g, ""), "base64").toString("utf8");
}

function listWorkspaceRoots(tree: GitTreeEntry[]): string[] {
  const roots = new Set<string>();
  const prefix = ".eshttp/workspaces/";

  for (const entry of tree) {
    if (entry.type !== "blob" || !entry.path.endsWith(".http") || !entry.path.startsWith(prefix)) {
      continue;
    }

    const remainder = entry.path.slice(prefix.length);
    const [workspaceName] = remainder.split("/");
    if (!workspaceName) {
      continue;
    }

    roots.add(`${prefix}${workspaceName}`);
  }

  return Array.from(roots).sort((left, right) => left.localeCompare(right));
}

function relativeToWorkspace(workspacePath: string, fullPath: string): string | null {
  if (fullPath === workspacePath) {
    return ".";
  }

  if (!fullPath.startsWith(`${workspacePath}/`)) {
    return null;
  }

  return fullPath.slice(workspacePath.length + 1);
}

async function buildWorkspaceSnapshot(
  accessToken: string,
  repo: GitHubRepo,
  workspacePath: string,
  tree: GitTreeEntry[],
): Promise<WorkspaceSnapshot | null> {
  const relevantFiles = tree.filter(
    (entry) => entry.type === "blob" && relativeToWorkspace(workspacePath, entry.path) !== null,
  );
  if (relevantFiles.length === 0) {
    return null;
  }

  const blobByPath = new Map<string, string>();
  for (const entry of relevantFiles) {
    blobByPath.set(entry.path, entry.sha);
  }

  const blobTextBySha = new Map<string, string>();
  async function blobTextForSha(sha: string): Promise<string> {
    const existing = blobTextBySha.get(sha);
    if (existing != null) {
      return existing;
    }

    const text = await fetchBlobText(accessToken, repo.owner.login, repo.name, sha);
    blobTextBySha.set(sha, text);
    return text;
  }

  const collectionDraft = new Map<
    string,
    {
      relativePath: string;
      name: string;
      requests: WorkspaceRequestSnapshot[];
      iconSvg: string | null;
    }
  >();

  for (const entry of relevantFiles) {
    if (!entry.path.endsWith(".http")) {
      continue;
    }

    const relativePath = relativeToWorkspace(workspacePath, entry.path);
    if (!relativePath || relativePath === ".") {
      continue;
    }

    const fileName = basename(relativePath);
    const collectionPath = normalizeRelativePath(dirname(relativePath));
    if (!collectionPath) {
      continue;
    }

    const sha = blobByPath.get(entry.path);
    if (!sha) {
      continue;
    }

    const text = await blobTextForSha(sha);
    const target = collectionDraft.get(collectionPath) ?? {
      relativePath: collectionPath,
      name: collectionPath,
      requests: [],
      iconSvg: null,
    };

    target.requests.push({
      fileName,
      title: parseTitleFromFileName(fileName),
      text,
    });
    collectionDraft.set(collectionPath, target);
  }

  for (const [collectionPath, draft] of collectionDraft.entries()) {
    const iconPath =
      collectionPath === "."
        ? `${workspacePath}/icon.svg`
        : `${workspacePath}/${collectionPath}/icon.svg`;
    const iconSha = blobByPath.get(iconPath);
    if (!iconSha) {
      continue;
    }

    draft.iconSvg = await blobTextForSha(iconSha);
  }

  const collections = Array.from(collectionDraft.values())
    .map((entry) => ({
      ...entry,
      requests: entry.requests.sort((left, right) => left.fileName.localeCompare(right.fileName)),
    }))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  if (collections.length === 0) {
    return null;
  }

  return {
    owner: repo.owner.login,
    repo: repo.name,
    branch: repo.default_branch,
    workspacePath,
    workspaceName: basename(workspacePath),
    collections,
  };
}

export async function exchangeGitHubCodeForToken(input: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}): Promise<GitHubTokenResponse> {
  const params = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.codeVerifier,
  });

  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!response.ok) {
    throw new Error(`GitHub OAuth token exchange failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    access_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!payload.access_token) {
    throw new Error(
      payload.error_description || payload.error || "GitHub OAuth token exchange failed",
    );
  }

  return {
    accessToken: payload.access_token,
    scopes: parseScopeList(payload.scope),
  };
}

export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  const user = await githubRequest<{ id: number; login: string }>(accessToken, "/user");
  return {
    id: String(user.id),
    login: user.login,
  };
}

export async function listUserRepos(accessToken: string, maxRepos: number): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  const pageSize = Math.min(100, Math.max(1, maxRepos));
  let page = 1;

  while (repos.length < maxRepos) {
    const pageItems = await githubRequest<GitHubRepo[]>(
      accessToken,
      `/user/repos?per_page=${pageSize}&page=${page}&sort=updated&direction=desc`,
    );

    if (pageItems.length === 0) {
      break;
    }

    repos.push(...pageItems);
    if (pageItems.length < pageSize) {
      break;
    }

    page += 1;
  }

  return repos.slice(0, maxRepos);
}

export async function extractWorkspacesFromRepos(
  accessToken: string,
  maxRepos: number,
): Promise<WorkspaceSnapshot[]> {
  const repos = await listUserRepos(accessToken, maxRepos);
  const snapshots: WorkspaceSnapshot[] = [];

  for (const repo of repos) {
    const tree = await githubRequest<GitTreeResponse>(
      accessToken,
      `/repos/${encodeURIComponent(repo.owner.login)}/${encodeURIComponent(repo.name)}/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`,
    );

    if (tree.truncated) {
      continue;
    }

    const workspaceRoots = listWorkspaceRoots(tree.tree);
    for (const workspacePath of workspaceRoots) {
      const snapshot = await buildWorkspaceSnapshot(accessToken, repo, workspacePath, tree.tree);
      if (snapshot) {
        snapshots.push(snapshot);
      }
    }
  }

  return snapshots;
}

export async function commitWorkspaceFiles(
  accessToken: string,
  input: CommitWorkspaceInput,
): Promise<{ commitSha: string }> {
  const workspacePath = normalizeRelativePath(input.workspacePath);
  if (!workspacePath) {
    throw new Error("Invalid workspace path");
  }

  const entries = Object.entries(input.files);
  if (entries.length === 0) {
    throw new Error("No files provided for commit");
  }

  const ref = await githubRequest<RefResponse>(
    accessToken,
    `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/git/ref/heads/${encodeURIComponent(input.branch)}`,
  );

  const parentCommit = await githubRequest<CommitResponse>(
    accessToken,
    `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/git/commits/${encodeURIComponent(ref.object.sha)}`,
  );

  const treeEntries: Array<{ path: string; mode: string; type: string; sha: string }> = [];
  for (const [relativePath, text] of entries) {
    const normalizedPath = normalizeRelativePath(relativePath);
    if (!normalizedPath) {
      throw new Error(`Invalid path: ${relativePath}`);
    }

    const fullPath = joinRepoPath(workspacePath, normalizedPath);
    if (!fullPath || fullPath === ".") {
      throw new Error(`Invalid commit path: ${relativePath}`);
    }

    const blob = await githubRequest<{ sha: string }>(
      accessToken,
      `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/git/blobs`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          content: Buffer.from(text, "utf8").toString("base64"),
          encoding: "base64",
        }),
      },
    );

    treeEntries.push({
      path: fullPath,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });
  }

  const tree = await githubRequest<{ sha: string }>(
    accessToken,
    `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/git/trees`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        base_tree: parentCommit.tree.sha,
        tree: treeEntries,
      }),
    },
  );

  const commit = await githubRequest<{ sha: string }>(
    accessToken,
    `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/git/commits`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: input.message,
        tree: tree.sha,
        parents: [ref.object.sha],
      }),
    },
  );

  await githubRequest(
    accessToken,
    `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/git/refs/heads/${encodeURIComponent(input.branch)}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sha: commit.sha,
        force: false,
      }),
    },
  );

  return {
    commitSha: commit.sha,
  };
}
