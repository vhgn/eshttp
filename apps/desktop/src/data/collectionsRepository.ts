import type { Collection, RequestFile, Workspace } from "@eshttp/core";
import { invokeTauri, isTauriRuntime } from "../runtime";
import { getCollectionIconOption, renderCollectionIconSvg } from "./collectionIcons";
import {
  type CacheCollectionRecord,
  type CacheRequestRecord,
  type CacheWorkspaceRecord,
  deleteSyncOp,
  getCacheWorkspace,
  type ImportRecord,
  type ImportRuntime,
  listImports,
  listSyncQueue,
  putCacheWorkspace,
  putImport,
  putSyncOp,
} from "./idb";

export type WorkspaceMode = "readonly" | "editable";
export type SyncState = "synced" | "pending" | "error";

export interface WorkspaceTreeNode {
  workspace: Workspace;
  mode: WorkspaceMode;
  importId: string;
  syncState: SyncState;
  collections: Array<{
    relativePath: string;
    collection: Collection;
    iconSvg: string | null;
    requests: RequestFile[];
  }>;
}

interface RequestIndexEntry {
  mode: WorkspaceMode;
  runtime: ImportRuntime;
  importId: string;
  workspaceId: string;
  collectionId: string;
  fileName: string;
  collectionRelativePath: string;
  requestRelativePath: string;
  absolutePath?: string;
}

interface CollectionIndexEntry {
  mode: WorkspaceMode;
  runtime: ImportRuntime;
  importId: string;
  workspaceId: string;
  relativePath: string;
  absolutePath?: string;
}

interface WorkspaceIndexEntry {
  mode: WorkspaceMode;
  runtime: ImportRuntime;
  importId: string;
  rootPath?: string;
}

interface SaveResult {
  workspaceId: string;
  collectionId: string;
  requestId: string;
}

type WebPermissionDescriptor = {
  mode?: "read" | "readwrite";
};

type WebDirectoryHandle = FileSystemDirectoryHandle & {
  values?: () => AsyncIterable<FileSystemHandle>;
  queryPermission?: (descriptor: WebPermissionDescriptor) => Promise<PermissionState>;
  requestPermission?: (descriptor: WebPermissionDescriptor) => Promise<PermissionState>;
};

const SYNC_INTERVAL_MS = 2_000;

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

function basename(path: string): string {
  const normalized = normalizePath(path);
  const sections = normalized.split("/").filter(Boolean);
  return sections[sections.length - 1] ?? path;
}

function relativePath(rootPath: string, valuePath: string): string {
  const root = normalizePath(rootPath).replace(/\/+$/, "");
  const value = normalizePath(valuePath);

  if (value === root) {
    return ".";
  }

  if (!value.startsWith(`${root}/`)) {
    return ".";
  }

  return value.slice(root.length + 1);
}

function normalizeCollectionRelativePath(path: string): string | null {
  const normalized = normalizePath(path).replace(/^\/+|\/+$/g, "");
  if (!normalized || normalized === ".") {
    return null;
  }

  const segments = normalized
    .split("/")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  if (segments.some((entry) => entry === "." || entry === "..")) {
    return null;
  }

  return segments.join("/");
}

function makeWorkspaceId(mode: WorkspaceMode, importId: string): string {
  return `workspace:${mode}:${importId}`;
}

function makeCollectionId(
  mode: WorkspaceMode,
  importId: string,
  relativePathValue: string,
): string {
  return `collection:${mode}:${importId}:${relativePathValue}`;
}

function makeRequestId(
  mode: WorkspaceMode,
  importId: string,
  relativePathValue: string,
  fileName: string,
): string {
  return `request:${mode}:${importId}:${relativePathValue}:${fileName}`;
}

function requestTitleFromFileName(fileName: string): string {
  return fileName.endsWith(".http") ? fileName.slice(0, -".http".length) : fileName;
}

function buildSyncStatus(
  importId: string,
  syncQueue: Awaited<ReturnType<typeof listSyncQueue>>,
): SyncState {
  const importOps = syncQueue.filter((op) => op.importId === importId);
  if (importOps.some((op) => op.error)) {
    return "error";
  }

  return importOps.length > 0 ? "pending" : "synced";
}

function getRequestRelativePath(collectionRelativePath: string, fileName: string): string {
  if (collectionRelativePath === ".") {
    return fileName;
  }

  return `${collectionRelativePath}/${fileName}`;
}

async function readFileFromHandle(
  root: FileSystemDirectoryHandle,
  relativePathValue: string,
): Promise<string | null> {
  const segments = relativePathValue.split("/").filter(Boolean);
  if (segments.length === 0) {
    return null;
  }

  const fileName = segments.pop();
  if (!fileName) {
    return null;
  }

  let current = root;
  for (const segment of segments) {
    try {
      current = await current.getDirectoryHandle(segment);
    } catch {
      return null;
    }
  }

  try {
    const fileHandle = await current.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return file.text();
  } catch {
    return null;
  }
}

async function writeFileToHandle(
  root: FileSystemDirectoryHandle,
  relativePathValue: string,
  content: string,
): Promise<void> {
  const segments = relativePathValue.split("/").filter(Boolean);
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

interface WebCollectionSnapshot {
  relativePath: string;
  name: string;
  requestFileNames: string[];
  iconSvg: string | null;
}

async function scanWebCollections(
  root: FileSystemDirectoryHandle,
  currentPath: string[] = [],
): Promise<WebCollectionSnapshot[]> {
  let hasHttpFiles = false;
  const requestFileNames: string[] = [];
  const directoryEntries: Array<{ name: string; handle: FileSystemDirectoryHandle }> = [];

  const iteratorHost = root as WebDirectoryHandle;
  const values = iteratorHost.values?.();
  if (!values) {
    throw new Error("The current browser does not support directory iteration for imports.");
  }

  for await (const handle of values) {
    const name = handle.name;
    if (handle.kind === "file") {
      if (name.endsWith(".http")) {
        hasHttpFiles = true;
        requestFileNames.push(name);
      }

      continue;
    }

    if (handle.kind !== "directory") {
      continue;
    }

    directoryEntries.push({ name, handle: handle as FileSystemDirectoryHandle });
  }

  const relativePathValue = currentPath.length === 0 ? "." : currentPath.join("/");
  const results: WebCollectionSnapshot[] = [];

  if (hasHttpFiles) {
    results.push({
      relativePath: relativePathValue,
      name: relativePathValue,
      requestFileNames: requestFileNames.sort((a, b) => a.localeCompare(b)),
      iconSvg: await readFileFromHandle(root, "icon.svg"),
    });
  }

  for (const entry of directoryEntries.sort((a, b) => a.name.localeCompare(b.name))) {
    const nested = await scanWebCollections(entry.handle, [...currentPath, entry.name]);
    results.push(...nested);
  }

  return results;
}

async function ensureReadWritePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
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

function makeImportNameFromPath(path: string): string {
  return basename(path);
}

export class CollectionsRepository {
  private readonly runtime: ImportRuntime;
  private syncLoop: ReturnType<typeof setInterval> | null = null;

  private readonly requestIndex = new Map<string, RequestIndexEntry>();
  private readonly collectionIndex = new Map<string, CollectionIndexEntry>();
  private readonly workspaceIndex = new Map<string, WorkspaceIndexEntry>();

  constructor() {
    this.runtime = isTauriRuntime() ? "tauri" : "web";
  }

  startSyncLoop(): void {
    if (this.syncLoop) {
      return;
    }

    this.syncLoop = setInterval(() => {
      void this.flushSyncQueue();
    }, SYNC_INTERVAL_MS);
  }

  stopSyncLoop(): void {
    if (!this.syncLoop) {
      return;
    }

    clearInterval(this.syncLoop);
    this.syncLoop = null;
  }

  async createWorkspace(): Promise<string | null> {
    const record =
      this.runtime === "tauri" ? await this.importFromTauri() : await this.importFromWebPicker();

    if (!record) {
      return null;
    }

    await putImport(record);
    return makeWorkspaceId("readonly", record.id);
  }

  async importDirectory(): Promise<boolean> {
    const created = await this.createWorkspace();
    return created !== null;
  }

  async loadWorkspaceTree(): Promise<WorkspaceTreeNode[]> {
    this.requestIndex.clear();
    this.collectionIndex.clear();
    this.workspaceIndex.clear();

    const imports = await listImports();
    const syncQueue = await listSyncQueue();
    const trees: WorkspaceTreeNode[] = [];

    for (const importRecord of imports) {
      const syncState = buildSyncStatus(importRecord.id, syncQueue);

      const readonlyTree =
        importRecord.runtime === "tauri"
          ? await this.loadReadonlyTauriTree(importRecord, syncState)
          : await this.loadReadonlyWebTree(importRecord, syncState);

      if (readonlyTree) {
        trees.push(readonlyTree);
      }

      const cached = await getCacheWorkspace(importRecord.id);
      if (cached) {
        trees.push(this.loadEditableTree(cached, importRecord, syncState));
      }
    }

    return trees;
  }

  async readRequestText(requestId: string): Promise<string> {
    const index = this.requestIndex.get(requestId);
    if (!index) {
      throw new Error("Request not found in workspace tree");
    }

    if (index.mode === "editable") {
      const cache = await getCacheWorkspace(index.importId);
      if (!cache) {
        throw new Error("Editable cache workspace not found");
      }

      const collection = cache.collections.find(
        (entry) => entry.relativePath === index.collectionRelativePath,
      );
      const request = collection?.requests.find((entry) => entry.fileName === index.fileName);
      if (!request) {
        throw new Error("Cached request not found");
      }

      return request.text;
    }

    if (index.runtime === "tauri") {
      if (!index.absolutePath) {
        throw new Error("Readonly request path is missing");
      }

      const value = await this.readDesktopOptionalText(index.absolutePath);
      if (value == null) {
        throw new Error(`Failed to read request file: ${index.absolutePath}`);
      }

      return value;
    }

    const importRecord = await this.getImport(index.importId);
    if (!importRecord?.handle) {
      throw new Error("Web directory handle is missing for import");
    }

    const value = await readFileFromHandle(importRecord.handle, index.requestRelativePath);
    if (value == null) {
      throw new Error(`Failed to read request file: ${index.requestRelativePath}`);
    }

    return value;
  }

  async saveRequestText(requestId: string, text: string): Promise<SaveResult> {
    const existing = this.requestIndex.get(requestId);
    if (!existing) {
      throw new Error("Request not found in workspace tree");
    }

    const editable =
      existing.mode === "editable"
        ? existing
        : await this.ensureEditableRequestFromReadonly(existing.importId, existing);

    const cache = await getCacheWorkspace(editable.importId);
    if (!cache) {
      throw new Error("Failed to initialize editable cache workspace");
    }

    const collection = cache.collections.find(
      (entry) => entry.relativePath === editable.collectionRelativePath,
    );
    if (!collection) {
      throw new Error("Editable collection not found");
    }

    let request = collection.requests.find((entry) => entry.fileName === editable.fileName);
    if (!request) {
      request = {
        fileName: editable.fileName,
        title: requestTitleFromFileName(editable.fileName),
        text,
      };
      collection.requests.push(request);
    }

    request.text = text;
    await putCacheWorkspace(cache);

    await putSyncOp({
      id: crypto.randomUUID(),
      importId: editable.importId,
      type: "write",
      relativePath: editable.requestRelativePath,
      content: text,
      createdAt: Date.now(),
    });

    return {
      workspaceId: editable.workspaceId,
      collectionId: editable.collectionId,
      requestId: makeRequestId(
        "editable",
        editable.importId,
        editable.collectionRelativePath,
        editable.fileName,
      ),
    };
  }

  async setCollectionIcon(
    collectionId: string,
    iconId: string,
    color: string,
  ): Promise<{ workspaceId: string; collectionId: string }> {
    const existing = this.collectionIndex.get(collectionId);
    if (!existing) {
      throw new Error("Collection not found in workspace tree");
    }

    const editable =
      existing.mode === "editable"
        ? existing
        : await this.ensureEditableCollectionFromReadonly(existing.importId, existing);

    const iconOption = getCollectionIconOption(iconId);
    if (!iconOption) {
      throw new Error(`Unknown icon id: ${iconId}`);
    }

    const svg = renderCollectionIconSvg(iconOption.icon, color);

    const cache = await getCacheWorkspace(editable.importId);
    if (!cache) {
      throw new Error("Failed to initialize editable cache workspace");
    }

    const collection = cache.collections.find(
      (entry) => entry.relativePath === editable.relativePath,
    );
    if (!collection) {
      throw new Error("Editable collection missing");
    }

    collection.iconSvg = svg;
    await putCacheWorkspace(cache);

    await putSyncOp({
      id: crypto.randomUUID(),
      importId: editable.importId,
      type: "write",
      relativePath:
        editable.relativePath === "." ? "icon.svg" : `${editable.relativePath}/icon.svg`,
      content: svg,
      createdAt: Date.now(),
    });

    return {
      workspaceId: editable.workspaceId,
      collectionId: makeCollectionId("editable", editable.importId, editable.relativePath),
    };
  }

  async createCollection(
    workspaceId: string,
    collectionPath: string,
  ): Promise<{ workspaceId: string; collectionId: string }> {
    const workspace = this.workspaceIndex.get(workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found in workspace tree");
    }

    const relativePathValue = normalizeCollectionRelativePath(collectionPath);
    if (!relativePathValue) {
      throw new Error("Collection path must be a non-empty relative path.");
    }

    await this.ensureEditableWorkspace(workspace.importId);

    const cache = await getCacheWorkspace(workspace.importId);
    if (!cache) {
      throw new Error("Failed to initialize editable cache workspace");
    }

    if (cache.collections.some((entry) => entry.relativePath === relativePathValue)) {
      throw new Error(`Collection already exists at: ${relativePathValue}`);
    }

    cache.collections.push({
      relativePath: relativePathValue,
      name: relativePathValue,
      requests: [],
      iconSvg: null,
    });
    cache.collections.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
    await putCacheWorkspace(cache);

    await putSyncOp({
      id: crypto.randomUUID(),
      importId: workspace.importId,
      type: "write",
      relativePath: `${relativePathValue}/.env.default`,
      content: "",
      createdAt: Date.now(),
    });

    return {
      workspaceId: makeWorkspaceId("editable", workspace.importId),
      collectionId: makeCollectionId("editable", workspace.importId, relativePathValue),
    };
  }

  async readWorkspaceEnvironment(workspaceId: string, envName: string): Promise<string | null> {
    const workspace = this.workspaceIndex.get(workspaceId);
    if (!workspace) {
      return null;
    }

    if (workspace.runtime === "tauri") {
      const scopePath = workspace.rootPath;
      if (!scopePath) {
        return null;
      }

      return invokeTauri<string | null>("read_environment_file", { scopeUri: scopePath, envName });
    }

    const importRecord = await this.getImport(workspace.importId);
    if (!importRecord?.handle) {
      return null;
    }

    return readFileFromHandle(importRecord.handle, `.env.${envName}`);
  }

  async readCollectionEnvironment(collectionId: string, envName: string): Promise<string | null> {
    const collection = this.collectionIndex.get(collectionId);
    if (!collection) {
      return null;
    }

    if (collection.runtime === "tauri") {
      const scopePath =
        collection.absolutePath ??
        this.workspaceIndex.get(collection.workspaceId)?.rootPath ??
        undefined;

      if (!scopePath) {
        return null;
      }

      return invokeTauri<string | null>("read_environment_file", { scopeUri: scopePath, envName });
    }

    const importRecord = await this.getImport(collection.importId);
    if (!importRecord?.handle) {
      return null;
    }

    const target =
      collection.relativePath === "."
        ? `.env.${envName}`
        : `${collection.relativePath}/.env.${envName}`;

    return readFileFromHandle(importRecord.handle, target);
  }

  async flushSyncQueue(): Promise<void> {
    const queue = await listSyncQueue();
    for (const item of queue) {
      try {
        await this.applySyncWrite(item.importId, item.relativePath, item.content);
        await deleteSyncOp(item.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await putSyncOp({
          ...item,
          error: message,
        });
      }
    }
  }

  private async loadReadonlyTauriTree(
    importRecord: ImportRecord,
    syncState: SyncState,
  ): Promise<WorkspaceTreeNode | null> {
    if (!importRecord.path) {
      return null;
    }

    const workspaceId = makeWorkspaceId("readonly", importRecord.id);
    const workspace: Workspace = {
      id: workspaceId,
      name: importRecord.name,
      uri: importRecord.path,
    };

    this.workspaceIndex.set(workspaceId, {
      mode: "readonly",
      runtime: "tauri",
      importId: importRecord.id,
      rootPath: importRecord.path,
    });

    const discoveryWorkspace: Workspace = {
      id: `workspace:discover:${importRecord.id}`,
      name: importRecord.name,
      uri: importRecord.path,
    };

    const discovered = await invokeTauri<Collection[]>("discover_collections", {
      workspace: discoveryWorkspace,
    });

    const collections: WorkspaceTreeNode["collections"] = [];

    for (const discoveredCollection of discovered) {
      const relativePathValue = relativePath(importRecord.path, discoveredCollection.uri);
      const collectionId = makeCollectionId("readonly", importRecord.id, relativePathValue);
      const collection: Collection = {
        id: collectionId,
        workspaceId,
        name: discoveredCollection.name,
        uri: discoveredCollection.uri,
      };

      this.collectionIndex.set(collectionId, {
        mode: "readonly",
        runtime: "tauri",
        importId: importRecord.id,
        workspaceId,
        relativePath: relativePathValue,
        absolutePath: discoveredCollection.uri,
      });

      const discoveredRequests = await invokeTauri<RequestFile[]>("list_requests", {
        collection: discoveredCollection,
      });

      const requests = discoveredRequests.map((request) => {
        const fileName = basename(request.uri);
        const requestId = makeRequestId("readonly", importRecord.id, relativePathValue, fileName);
        const requestRelativePath = getRequestRelativePath(relativePathValue, fileName);

        this.requestIndex.set(requestId, {
          mode: "readonly",
          runtime: "tauri",
          importId: importRecord.id,
          workspaceId,
          collectionId,
          collectionRelativePath: relativePathValue,
          requestRelativePath,
          fileName,
          absolutePath: request.uri,
        });

        return {
          id: requestId,
          collectionId,
          title: request.title,
          uri: request.uri,
        } satisfies RequestFile;
      });

      const iconPath = joinFsPath(discoveredCollection.uri, "icon.svg");
      const iconSvg = await this.readDesktopOptionalText(iconPath);

      collections.push({
        relativePath: relativePathValue,
        collection,
        iconSvg,
        requests,
      });
    }

    return {
      workspace,
      mode: "readonly",
      importId: importRecord.id,
      syncState,
      collections,
    };
  }

  private async loadReadonlyWebTree(
    importRecord: ImportRecord,
    syncState: SyncState,
  ): Promise<WorkspaceTreeNode | null> {
    if (!importRecord.handle) {
      return null;
    }

    const workspaceId = makeWorkspaceId("readonly", importRecord.id);
    const workspace: Workspace = {
      id: workspaceId,
      name: importRecord.name,
      uri: `web://${importRecord.id}`,
    };

    this.workspaceIndex.set(workspaceId, {
      mode: "readonly",
      runtime: "web",
      importId: importRecord.id,
    });

    const snapshots = await scanWebCollections(importRecord.handle);
    const collections: WorkspaceTreeNode["collections"] = [];

    for (const snapshot of snapshots) {
      const collectionId = makeCollectionId("readonly", importRecord.id, snapshot.relativePath);
      const collection: Collection = {
        id: collectionId,
        workspaceId,
        name: snapshot.relativePath === "." ? importRecord.name : snapshot.name,
        uri: `web://${importRecord.id}/${snapshot.relativePath}`,
      };

      this.collectionIndex.set(collectionId, {
        mode: "readonly",
        runtime: "web",
        importId: importRecord.id,
        workspaceId,
        relativePath: snapshot.relativePath,
      });

      const requests = snapshot.requestFileNames.map((fileName) => {
        const requestId = makeRequestId(
          "readonly",
          importRecord.id,
          snapshot.relativePath,
          fileName,
        );
        const requestRelativePath = getRequestRelativePath(snapshot.relativePath, fileName);
        this.requestIndex.set(requestId, {
          mode: "readonly",
          runtime: "web",
          importId: importRecord.id,
          workspaceId,
          collectionId,
          collectionRelativePath: snapshot.relativePath,
          requestRelativePath,
          fileName,
        });

        return {
          id: requestId,
          collectionId,
          title: requestTitleFromFileName(fileName),
          uri: `web://${importRecord.id}/${requestRelativePath}`,
        } satisfies RequestFile;
      });

      collections.push({
        relativePath: snapshot.relativePath,
        collection,
        iconSvg: snapshot.iconSvg,
        requests,
      });
    }

    return {
      workspace,
      mode: "readonly",
      importId: importRecord.id,
      syncState,
      collections,
    };
  }

  private loadEditableTree(
    cache: CacheWorkspaceRecord,
    importRecord: ImportRecord,
    syncState: SyncState,
  ): WorkspaceTreeNode {
    const workspaceId = makeWorkspaceId("editable", importRecord.id);
    const workspace: Workspace = {
      id: workspaceId,
      name: `${cache.rootName} (editable)`,
      uri: `cache://${importRecord.id}`,
    };

    this.workspaceIndex.set(workspaceId, {
      mode: "editable",
      runtime: importRecord.runtime,
      importId: importRecord.id,
      rootPath: importRecord.path,
    });

    const collections: WorkspaceTreeNode["collections"] = cache.collections.map((entry) => {
      const collectionId = makeCollectionId("editable", importRecord.id, entry.relativePath);
      const collection: Collection = {
        id: collectionId,
        workspaceId,
        name: entry.name,
        uri: `cache://${importRecord.id}/${entry.relativePath}`,
      };

      this.collectionIndex.set(collectionId, {
        mode: "editable",
        runtime: importRecord.runtime,
        importId: importRecord.id,
        workspaceId,
        relativePath: entry.relativePath,
        absolutePath:
          importRecord.runtime === "tauri" && importRecord.path
            ? entry.relativePath === "."
              ? importRecord.path
              : joinFsPath(importRecord.path, entry.relativePath)
            : undefined,
      });

      const requests = entry.requests.map((request) => {
        const requestId = makeRequestId(
          "editable",
          importRecord.id,
          entry.relativePath,
          request.fileName,
        );
        const requestRelativePath = getRequestRelativePath(entry.relativePath, request.fileName);

        this.requestIndex.set(requestId, {
          mode: "editable",
          runtime: importRecord.runtime,
          importId: importRecord.id,
          workspaceId,
          collectionId,
          collectionRelativePath: entry.relativePath,
          requestRelativePath,
          fileName: request.fileName,
          absolutePath:
            importRecord.runtime === "tauri" && importRecord.path
              ? joinFsPath(importRecord.path, requestRelativePath)
              : undefined,
        });

        return {
          id: requestId,
          collectionId,
          title: request.title,
          uri: `cache://${importRecord.id}/${requestRelativePath}`,
        } satisfies RequestFile;
      });

      return {
        relativePath: entry.relativePath,
        collection,
        iconSvg: entry.iconSvg,
        requests,
      };
    });

    return {
      workspace,
      mode: "editable",
      importId: importRecord.id,
      syncState,
      collections,
    };
  }

  private async ensureEditableRequestFromReadonly(
    importId: string,
    request: RequestIndexEntry,
  ): Promise<RequestIndexEntry> {
    await this.ensureEditableWorkspace(importId);

    return {
      ...request,
      mode: "editable",
      workspaceId: makeWorkspaceId("editable", importId),
      collectionId: makeCollectionId("editable", importId, request.collectionRelativePath),
    };
  }

  private async ensureEditableCollectionFromReadonly(
    importId: string,
    collection: CollectionIndexEntry,
  ): Promise<CollectionIndexEntry> {
    await this.ensureEditableWorkspace(importId);

    return {
      ...collection,
      mode: "editable",
      workspaceId: makeWorkspaceId("editable", importId),
    };
  }

  private async ensureEditableWorkspace(importId: string): Promise<void> {
    const existing = await getCacheWorkspace(importId);
    if (existing) {
      return;
    }

    const importRecord = await this.getImport(importId);
    if (!importRecord) {
      throw new Error("Import metadata not found");
    }

    const cache =
      importRecord.runtime === "tauri"
        ? await this.snapshotReadonlyTauriWorkspace(importRecord)
        : await this.snapshotReadonlyWebWorkspace(importRecord);

    await putCacheWorkspace(cache);
  }

  private async snapshotReadonlyTauriWorkspace(
    importRecord: ImportRecord,
  ): Promise<CacheWorkspaceRecord> {
    if (!importRecord.path) {
      throw new Error("Missing imported directory path");
    }

    const discoverWorkspace: Workspace = {
      id: `workspace:snapshot:${importRecord.id}`,
      name: importRecord.name,
      uri: importRecord.path,
    };

    const collections = await invokeTauri<Collection[]>("discover_collections", {
      workspace: discoverWorkspace,
    });

    const cachedCollections: CacheCollectionRecord[] = [];

    for (const collection of collections) {
      const relativePathValue = relativePath(importRecord.path, collection.uri);
      const requests = await invokeTauri<RequestFile[]>("list_requests", {
        collection,
      });

      const cachedRequests: CacheRequestRecord[] = [];
      for (const request of requests) {
        const fileName = basename(request.uri);
        const text = (await this.readDesktopOptionalText(request.uri)) ?? "";
        cachedRequests.push({
          fileName,
          title: request.title,
          text,
        });
      }

      const iconSvg = await this.readDesktopOptionalText(joinFsPath(collection.uri, "icon.svg"));

      cachedCollections.push({
        relativePath: relativePathValue,
        name: collection.name,
        requests: cachedRequests,
        iconSvg,
      });
    }

    return {
      importId: importRecord.id,
      rootName: importRecord.name,
      collections: cachedCollections,
    };
  }

  private async snapshotReadonlyWebWorkspace(
    importRecord: ImportRecord,
  ): Promise<CacheWorkspaceRecord> {
    if (!importRecord.handle) {
      throw new Error("Missing imported directory handle");
    }

    const snapshots = await scanWebCollections(importRecord.handle);
    const cachedCollections: CacheCollectionRecord[] = [];

    for (const snapshot of snapshots) {
      const cachedRequests: CacheRequestRecord[] = [];
      for (const fileName of snapshot.requestFileNames) {
        const requestRelativePath = getRequestRelativePath(snapshot.relativePath, fileName);
        const text = (await readFileFromHandle(importRecord.handle, requestRelativePath)) ?? "";
        cachedRequests.push({
          fileName,
          title: requestTitleFromFileName(fileName),
          text,
        });
      }

      cachedCollections.push({
        relativePath: snapshot.relativePath,
        name: snapshot.relativePath === "." ? importRecord.name : snapshot.name,
        requests: cachedRequests,
        iconSvg: snapshot.iconSvg,
      });
    }

    return {
      importId: importRecord.id,
      rootName: importRecord.name,
      collections: cachedCollections,
    };
  }

  private async applySyncWrite(
    importId: string,
    relativePathValue: string,
    content: string,
  ): Promise<void> {
    const importRecord = await this.getImport(importId);
    if (!importRecord) {
      throw new Error(`Import ${importId} not found`);
    }

    if (importRecord.runtime === "tauri") {
      if (!importRecord.path) {
        throw new Error("Imported path is missing for tauri workspace");
      }

      const target = joinFsPath(importRecord.path, relativePathValue);
      await invokeTauri<void>("write_text_file", {
        path: target,
        contents: content,
      });
      return;
    }

    if (!importRecord.handle) {
      throw new Error("Imported web directory handle is missing");
    }

    const allowed = await ensureReadWritePermission(importRecord.handle);
    if (!allowed) {
      throw new Error("No write permission for selected directory");
    }

    await writeFileToHandle(importRecord.handle, relativePathValue, content);
  }

  private async importFromTauri(): Promise<ImportRecord | null> {
    const selected = await invokeTauri<string | null>("pick_directory");
    if (!selected) {
      return null;
    }

    return {
      id: crypto.randomUUID(),
      name: makeImportNameFromPath(selected),
      runtime: "tauri",
      path: selected,
      createdAt: Date.now(),
    };
  }

  private async importFromWebPicker(): Promise<ImportRecord | null> {
    const picker = (
      window as Window & { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }
    ).showDirectoryPicker;

    if (!picker) {
      throw new Error("This browser does not support directory picking (File System Access API).");
    }

    const handle = await picker();
    const hasPermission = await ensureReadWritePermission(handle);
    if (!hasPermission) {
      throw new Error("Read/write permission was not granted for the selected directory.");
    }

    return {
      id: crypto.randomUUID(),
      name: handle.name,
      runtime: "web",
      handle,
      createdAt: Date.now(),
    };
  }

  private async readDesktopOptionalText(path: string): Promise<string | null> {
    return invokeTauri<string | null>("read_text_file", { path });
  }

  private async getImport(importId: string): Promise<ImportRecord | null> {
    const imports = await listImports();
    return imports.find((entry) => entry.id === importId) ?? null;
  }
}

let repository: CollectionsRepository | null = null;

export function createCollectionsRepository(): CollectionsRepository {
  if (!repository) {
    repository = new CollectionsRepository();
  }

  return repository;
}
