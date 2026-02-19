export type ImportRuntime = "tauri" | "web";
export type ImportStorage = "filesystem" | "indexeddb";

export interface ImportRecord {
  id: string;
  name: string;
  runtime: ImportRuntime;
  createdAt: number;
  storage?: ImportStorage;
  path?: string;
  handle?: FileSystemDirectoryHandle;
}

export interface CacheRequestRecord {
  fileName: string;
  title: string;
  text: string;
}

export interface CacheCollectionRecord {
  relativePath: string;
  name: string;
  requests: CacheRequestRecord[];
  iconSvg: string | null;
}

export interface CacheWorkspaceRecord {
  importId: string;
  rootName: string;
  collections: CacheCollectionRecord[];
}

export type SyncOpType = "write";

export interface SyncQueueRecord {
  id: string;
  importId: string;
  type: SyncOpType;
  relativePath: string;
  content: string;
  createdAt: number;
  error?: string;
}

const DB_NAME = "eshttp-desktop";
const DB_VERSION = 1;

const STORE_IMPORTS = "imports";
const STORE_CACHE = "workspace_cache";
const STORE_SYNC_QUEUE = "sync_queue";

let dbPromise: Promise<IDBDatabase> | null = null;

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore, tx: IDBTransaction) => Promise<T>,
): Promise<T> {
  const db = await openDatabase();
  const tx = db.transaction(storeName, mode);
  const store = tx.objectStore(storeName);
  const result = await callback(store, tx);
  await transactionDone(tx);
  return result;
}

async function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_IMPORTS)) {
        db.createObjectStore(STORE_IMPORTS, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: "importId" });
      }

      if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
        db.createObjectStore(STORE_SYNC_QUEUE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });

  return dbPromise;
}

export async function listImports(): Promise<ImportRecord[]> {
  return withStore(STORE_IMPORTS, "readonly", async (store) => {
    const values = await requestToPromise(store.getAll());
    return (values as ImportRecord[]).sort((a, b) => a.createdAt - b.createdAt);
  });
}

export async function putImport(record: ImportRecord): Promise<void> {
  await withStore(STORE_IMPORTS, "readwrite", async (store) => {
    store.put(record);
  });
}

export async function getCacheWorkspace(importId: string): Promise<CacheWorkspaceRecord | null> {
  return withStore(STORE_CACHE, "readonly", async (store) => {
    const value = await requestToPromise(store.get(importId));
    return (value as CacheWorkspaceRecord | undefined) ?? null;
  });
}

export async function putCacheWorkspace(record: CacheWorkspaceRecord): Promise<void> {
  await withStore(STORE_CACHE, "readwrite", async (store) => {
    store.put(record);
  });
}

export async function listSyncQueue(): Promise<SyncQueueRecord[]> {
  return withStore(STORE_SYNC_QUEUE, "readonly", async (store) => {
    const values = await requestToPromise(store.getAll());
    return (values as SyncQueueRecord[]).sort((a, b) => a.createdAt - b.createdAt);
  });
}

export async function putSyncOp(record: SyncQueueRecord): Promise<void> {
  await withStore(STORE_SYNC_QUEUE, "readwrite", async (store) => {
    store.put(record);
  });
}

export async function deleteSyncOp(id: string): Promise<void> {
  await withStore(STORE_SYNC_QUEUE, "readwrite", async (store) => {
    store.delete(id);
  });
}
