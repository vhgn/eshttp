import { access, constants, readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import {
  type Collection,
  type CollectionSource,
  type DiscoveryConfig,
  matchesEntryPattern,
  parseDiscoveryConfig,
  pathIncludedByConfig,
  type RequestFile,
  type Workspace,
} from "@eshttp/core";

interface ActiveConfig {
  originDir: string;
  config: DiscoveryConfig;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function getUserConfigBaseDir(): string {
  const home = homedir();

  if (process.platform === "win32") {
    return process.env.APPDATA ?? join(home, "AppData", "Roaming");
  }

  if (process.platform === "darwin") {
    return join(home, "Library", "Application Support");
  }

  return process.env.XDG_CONFIG_HOME ?? join(home, ".config");
}

export function getWorkspaceRoots(cwd = process.cwd()): string[] {
  return [join(cwd, ".eshttp", "workspaces"), join(getUserConfigBaseDir(), "eshttp", "workspaces")];
}

function normalizePath(path: string): string {
  return path.split(sep).join("/");
}

function createId(prefix: string, value: string): string {
  return `${prefix}:${normalizePath(value)}`;
}

async function listDirectories(path: string): Promise<string[]> {
  if (!(await exists(path))) {
    return [];
  }

  const entries = await readdir(path, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

async function readConfigFrom(dirPath: string): Promise<DiscoveryConfig | null> {
  const configPath = join(dirPath, ".eshttp.json");
  if (!(await exists(configPath))) {
    return null;
  }

  const rawText = await readFile(configPath, "utf8");
  return parseDiscoveryConfig(rawText);
}

async function findCollectionsInWorkspace(
  workspace: Workspace,
  dirPath: string,
  activeConfig: ActiveConfig | null,
  results: Collection[],
): Promise<void> {
  const localConfig = await readConfigFrom(dirPath);
  const effectiveConfig = localConfig
    ? {
        originDir: dirPath,
        config: localConfig,
      }
    : activeConfig;

  const relativeToWorkspace = normalizePath(relative(workspace.uri, dirPath) || ".");

  if (
    effectiveConfig?.config &&
    !pathIncludedByConfig(relativeToWorkspace, effectiveConfig.config)
  ) {
    return;
  }

  const entries = await readdir(dirPath, { withFileTypes: true });

  const httpFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".http"));

  if (httpFiles.length > 0) {
    const relativeToConfigOrigin = effectiveConfig
      ? normalizePath(relative(effectiveConfig.originDir, dirPath) || ".")
      : ".";

    const isEntryMatch = effectiveConfig?.config
      ? matchesEntryPattern(relativeToConfigOrigin, effectiveConfig.config)
      : true;

    if (isEntryMatch) {
      const collectionName = relativeToWorkspace === "." ? workspace.name : relativeToWorkspace;
      results.push({
        id: createId("collection", `${workspace.id}/${relativeToWorkspace}`),
        workspaceId: workspace.id,
        name: collectionName,
        uri: dirPath,
      });
    }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const childPath = join(dirPath, entry.name);
    await findCollectionsInWorkspace(workspace, childPath, effectiveConfig, results);
  }
}

export class LocalFsCollectionSource implements CollectionSource {
  readonly kind = "local-fs";

  constructor(private readonly cwd = process.cwd()) {}

  async listWorkspaces(): Promise<Workspace[]> {
    const roots = getWorkspaceRoots(this.cwd);
    const results: Workspace[] = [];

    for (const root of roots) {
      const workspaceNames = await listDirectories(root);
      for (const workspaceName of workspaceNames) {
        const workspacePath = resolve(root, workspaceName);
        results.push({
          id: createId("workspace", workspacePath),
          name: workspaceName,
          uri: workspacePath,
        });
      }
    }

    const uniqueByUri = new Map<string, Workspace>();
    for (const workspace of results) {
      if (!uniqueByUri.has(workspace.uri)) {
        uniqueByUri.set(workspace.uri, workspace);
      }
    }

    return [...uniqueByUri.values()];
  }

  async discoverCollections(workspace: Workspace): Promise<Collection[]> {
    const metadata = await stat(workspace.uri).catch(() => null);
    if (!metadata || !metadata.isDirectory()) {
      return [];
    }

    const results: Collection[] = [];
    await findCollectionsInWorkspace(workspace, workspace.uri, null, results);

    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  async listRequests(collection: Collection): Promise<RequestFile[]> {
    const entries = await readdir(collection.uri, { withFileTypes: true });

    const requests = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".http"))
      .map((entry) => {
        const title = entry.name.slice(0, -".http".length);
        const uri = join(collection.uri, entry.name);
        return {
          id: createId("request", uri),
          collectionId: collection.id,
          title,
          uri,
        };
      });

    return requests.sort((a, b) => a.title.localeCompare(b.title));
  }

  async readRequestText(request: RequestFile): Promise<string> {
    return readFile(request.uri, "utf8");
  }

  async readEnvironmentFile(scopeUri: string, envName: string): Promise<string | null> {
    const envPath = join(scopeUri, `.env.${envName}`);
    if (!(await exists(envPath))) {
      return null;
    }

    return readFile(envPath, "utf8");
  }
}
