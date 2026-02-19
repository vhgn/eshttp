import {
  buildRequest,
  type Collection,
  mergeEnvironment,
  parseEnvText,
  parseHttpRequestText,
  type RequestFile,
  type Workspace,
} from "@eshttp/core";
import Editor from "@monaco-editor/react";
import type { ChangeEvent, ComponentProps } from "react";
import { useEffect, useMemo, useState } from "react";
import appIcon from "../src-tauri/icons/icon.png";
import { InlineMonacoInput } from "./components/InlineMonacoInput";
import { COLLECTION_ICON_OPTIONS, svgToDataUri } from "./data/collectionIcons";
import { createCollectionsRepository, type WorkspaceTreeNode } from "./data/collectionsRepository";
import { registerInlineLanguage, setInlineCompletionEnvKeys } from "./monaco/inlineLanguage";
import { createDesktopTransport } from "./transports";

interface Selection {
  workspace: Workspace;
  collection: Collection;
  request: RequestFile;
}

interface CollectionTreeBranch {
  key: string;
  label: string;
  relativePath: string;
  collectionNode: WorkspaceTreeNode["collections"][number] | null;
  children: CollectionTreeBranch[];
}

type ThemeName = "black" | "light" | "soft" | "gruvbox";
type BodyMode = "editor" | "file";
type PayloadLanguage = "json" | "graphql";
type PanelTab = "params" | "headers" | "auth" | "body";
type ResponseTab = "request" | "response";
type Monaco = Parameters<NonNullable<ComponentProps<typeof Editor>["beforeMount"]>>[0];

interface KeyValueRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

interface ToastMessage {
  id: string;
  tone: "error" | "info";
  text: string;
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
const MONACO_THEME_BY_APP_THEME: Record<ThemeName, string> = {
  black: "eshttp-black",
  light: "eshttp-light",
  soft: "eshttp-soft",
  gruvbox: "eshttp-gruvbox",
};
const ACCENTS_BY_THEME: Record<
  ThemeName,
  Array<{ token: string; label: string; value: string }>
> = {
  black: [
    { token: "accent-1", label: "Primary", value: "#6bcf6a" },
    { token: "accent-2", label: "Mint", value: "#84d1a0" },
    { token: "accent-3", label: "Amber", value: "#d79b67" },
    { token: "accent-4", label: "Sky", value: "#66b3ff" },
    { token: "accent-5", label: "Rose", value: "#de7f95" },
  ],
  light: [
    { token: "accent-1", label: "Primary", value: "#2d8d37" },
    { token: "accent-2", label: "Teal", value: "#286e60" },
    { token: "accent-3", label: "Amber", value: "#a05a2c" },
    { token: "accent-4", label: "Sky", value: "#2f74c9" },
    { token: "accent-5", label: "Rose", value: "#b44d6f" },
  ],
  soft: [
    { token: "accent-1", label: "Primary", value: "#8cb66b" },
    { token: "accent-2", label: "Moss", value: "#b0c6a3" },
    { token: "accent-3", label: "Sand", value: "#c8a379" },
    { token: "accent-4", label: "Sky", value: "#7da9d8" },
    { token: "accent-5", label: "Rose", value: "#cb8ea0" },
  ],
  gruvbox: [
    { token: "accent-1", label: "Primary", value: "#b8bb26" },
    { token: "accent-2", label: "Green", value: "#8ec07c" },
    { token: "accent-3", label: "Orange", value: "#d79921" },
    { token: "accent-4", label: "Blue", value: "#83a598" },
    { token: "accent-5", label: "Red", value: "#fb4934" },
  ],
};

let monacoThemesRegistered = false;

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function registerMonacoThemes(monaco: Monaco) {
  registerInlineLanguage(monaco);
  if (monacoThemesRegistered) {
    return;
  }

  monaco.editor.defineTheme("eshttp-black", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "8D8D8D", fontStyle: "italic" },
      { token: "string", foreground: "A8CF76" },
      { token: "number", foreground: "D79B67" },
      { token: "keyword", foreground: "6BCF6A" },
      { token: "type", foreground: "84D1A0" },
      { token: "delimiter", foreground: "CCCCCC" },
      { token: "placeholder.delimiter", foreground: "6BCF6A" },
      { token: "placeholder.key", foreground: "84D1A0", fontStyle: "bold" },
    ],
    colors: {
      "editor.background": "#121212",
      "editor.foreground": "#F2F2F2",
      "editor.lineHighlightBackground": "#181818",
      "editorCursor.foreground": "#6BCF6A",
      "editorLineNumber.foreground": "#595959",
      "editorLineNumber.activeForeground": "#AAAAAA",
      "editor.selectionBackground": "#254327",
      "editor.inactiveSelectionBackground": "#1B2D1D",
      "editorWhitespace.foreground": "#323232",
      "editorIndentGuide.background1": "#2A2A2A",
      "editorIndentGuide.activeBackground1": "#414141",
      "editorGutter.background": "#121212",
    },
  });

  monaco.editor.defineTheme("eshttp-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "7A7A7A", fontStyle: "italic" },
      { token: "string", foreground: "3F7D42" },
      { token: "number", foreground: "A05A2C" },
      { token: "keyword", foreground: "2D8D37" },
      { token: "type", foreground: "286E60" },
      { token: "delimiter", foreground: "505050" },
      { token: "placeholder.delimiter", foreground: "2D8D37" },
      { token: "placeholder.key", foreground: "286E60", fontStyle: "bold" },
    ],
    colors: {
      "editor.background": "#FFFFFF",
      "editor.foreground": "#131313",
      "editor.lineHighlightBackground": "#F5F7F5",
      "editorCursor.foreground": "#2D8D37",
      "editorLineNumber.foreground": "#A3A3A3",
      "editorLineNumber.activeForeground": "#5B5B5B",
      "editor.selectionBackground": "#CCE8CF",
      "editor.inactiveSelectionBackground": "#DFEFE1",
      "editorWhitespace.foreground": "#D9D9D9",
      "editorIndentGuide.background1": "#E6E6E6",
      "editorIndentGuide.activeBackground1": "#CBCBCB",
      "editorGutter.background": "#FFFFFF",
    },
  });

  monaco.editor.defineTheme("eshttp-soft", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "8D8D8D", fontStyle: "italic" },
      { token: "string", foreground: "A5BE8A" },
      { token: "number", foreground: "C8A379" },
      { token: "keyword", foreground: "8CB66B" },
      { token: "type", foreground: "B0C6A3" },
      { token: "delimiter", foreground: "C9C9C9" },
      { token: "placeholder.delimiter", foreground: "8CB66B" },
      { token: "placeholder.key", foreground: "B0C6A3", fontStyle: "bold" },
    ],
    colors: {
      "editor.background": "#202020",
      "editor.foreground": "#E2E2E2",
      "editor.lineHighlightBackground": "#292929",
      "editorCursor.foreground": "#8CB66B",
      "editorLineNumber.foreground": "#707070",
      "editorLineNumber.activeForeground": "#B0B0B0",
      "editor.selectionBackground": "#3A4731",
      "editor.inactiveSelectionBackground": "#313C2A",
      "editorWhitespace.foreground": "#3E3E3E",
      "editorIndentGuide.background1": "#383838",
      "editorIndentGuide.activeBackground1": "#505050",
      "editorGutter.background": "#202020",
    },
  });

  monaco.editor.defineTheme("eshttp-gruvbox", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "928374", fontStyle: "italic" },
      { token: "string", foreground: "B8BB26" },
      { token: "number", foreground: "D79921" },
      { token: "keyword", foreground: "FB4934" },
      { token: "type", foreground: "8EC07C" },
      { token: "delimiter", foreground: "D5C4A1" },
      { token: "placeholder.delimiter", foreground: "FE8019" },
      { token: "placeholder.key", foreground: "B8BB26", fontStyle: "bold" },
    ],
    colors: {
      "editor.background": "#282828",
      "editor.foreground": "#EBDBB2",
      "editor.lineHighlightBackground": "#32302F",
      "editorCursor.foreground": "#FE8019",
      "editorLineNumber.foreground": "#7C6F64",
      "editorLineNumber.activeForeground": "#A89984",
      "editor.selectionBackground": "#504945",
      "editor.inactiveSelectionBackground": "#3C3836",
      "editorWhitespace.foreground": "#5A524C",
      "editorIndentGuide.background1": "#4A4440",
      "editorIndentGuide.activeBackground1": "#665C54",
      "editorGutter.background": "#282828",
    },
  });

  monacoThemesRegistered = true;
}

function createRow(partial?: Partial<KeyValueRow>): KeyValueRow {
  return {
    id: crypto.randomUUID(),
    key: partial?.key ?? "",
    value: partial?.value ?? "",
    enabled: partial?.enabled ?? true,
  };
}

function parseQueryRows(url: string): { baseUrl: string; rows: KeyValueRow[] } {
  const [baseUrl = "", queryString = ""] = url.split("?", 2);
  if (!queryString) {
    return { baseUrl, rows: [] };
  }

  const rows = queryString
    .split("&")
    .filter(Boolean)
    .map((part) => {
      const [rawKey = "", rawValue = ""] = part.split("=", 2);
      const decodeSafe = (value: string): string => {
        try {
          return decodeURIComponent(value);
        } catch {
          return value;
        }
      };

      return createRow({
        key: decodeSafe(rawKey),
        value: decodeSafe(rawValue),
        enabled: true,
      });
    });

  return { baseUrl, rows };
}

function buildUrl(baseUrl: string, params: KeyValueRow[]): string {
  const trimmed = baseUrl.trim();
  const query = params
    .filter((row) => row.enabled && row.key.trim())
    .map((row) => `${row.key.trim()}=${row.value.trim()}`)
    .join("&");

  if (!query) {
    return trimmed;
  }

  const separator = trimmed.includes("?") ? "&" : "?";
  return `${trimmed}${separator}${query}`;
}

function rowsToHeaderMap(rows: KeyValueRow[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (const row of rows) {
    const key = row.key.trim();
    if (!row.enabled || !key) {
      continue;
    }

    result[key] = row.value;
  }

  return result;
}

function headersToRows(headers: Record<string, string>): KeyValueRow[] {
  return Object.entries(headers).map(([key, value]) => createRow({ key, value, enabled: true }));
}

function detectPayloadLanguage(value: string | undefined): PayloadLanguage {
  if (!value) {
    return "json";
  }

  const trimmed = value.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return "json";
  }

  return "graphql";
}

function buildRequestText(
  method: string,
  baseUrl: string,
  params: KeyValueRow[],
  headers: KeyValueRow[],
  bearerToken: string,
  bodyText: string,
): string {
  const url = buildUrl(baseUrl, params);
  const mergedHeaders = rowsToHeaderMap(headers);

  if (bearerToken.trim()) {
    mergedHeaders.Authorization = `Bearer ${bearerToken.trim()}`;
  }

  const headerLines = Object.entries(mergedHeaders).map(([key, value]) => `${key}: ${value}`);
  const firstLine = `${method} ${url}`;

  if (!bodyText.trim()) {
    if (headerLines.length === 0) {
      return firstLine;
    }

    return [firstLine, ...headerLines].join("\n");
  }

  if (headerLines.length === 0) {
    return [firstLine, "", bodyText].join("\n");
  }

  return [firstLine, ...headerLines, "", bodyText].join("\n");
}

async function readCombinedEnv(
  readEnvironmentFile: (envName: string) => Promise<string | null>,
  envName: string,
): Promise<string> {
  const defaultEnv = await readEnvironmentFile("default");
  const selectedEnv = envName === "default" ? null : await readEnvironmentFile(envName);

  return [defaultEnv ?? "", selectedEnv ?? ""].filter(Boolean).join("\n");
}

interface SelectionLocator {
  workspaceId: string;
  collectionId: string;
  requestId: string;
}

function findSelectionByLocator(
  workspaceTree: WorkspaceTreeNode[],
  locator: SelectionLocator,
): Selection | null {
  for (const workspaceNode of workspaceTree) {
    if (workspaceNode.workspace.id !== locator.workspaceId) {
      continue;
    }

    for (const collectionNode of workspaceNode.collections) {
      if (collectionNode.collection.id !== locator.collectionId) {
        continue;
      }

      const request = collectionNode.requests.find((entry) => entry.id === locator.requestId);
      if (!request) {
        continue;
      }

      return {
        workspace: workspaceNode.workspace,
        collection: collectionNode.collection,
        request,
      };
    }
  }

  return null;
}

function buildCollectionTree(
  collections: WorkspaceTreeNode["collections"],
): CollectionTreeBranch[] {
  interface DraftBranch {
    label: string;
    relativePath: string;
    collectionNode: WorkspaceTreeNode["collections"][number] | null;
    children: Map<string, DraftBranch>;
  }

  const root: DraftBranch = {
    label: "",
    relativePath: ".",
    collectionNode: null,
    children: new Map(),
  };

  for (const node of collections) {
    const segments = node.relativePath === "." ? [] : node.relativePath.split("/").filter(Boolean);
    let current = root;
    let currentPath = ".";

    for (const segment of segments) {
      currentPath = currentPath === "." ? segment : `${currentPath}/${segment}`;
      const existing = current.children.get(segment);
      if (existing) {
        current = existing;
        continue;
      }

      const next: DraftBranch = {
        label: segment,
        relativePath: currentPath,
        collectionNode: null,
        children: new Map(),
      };
      current.children.set(segment, next);
      current = next;
    }

    current.collectionNode = node;
  }

  const sortDrafts = (left: DraftBranch, right: DraftBranch) =>
    left.relativePath.localeCompare(right.relativePath);

  const toBranch = (draft: DraftBranch): CollectionTreeBranch => ({
    key: draft.relativePath === "." ? "root" : draft.relativePath,
    label: draft.label,
    relativePath: draft.relativePath,
    collectionNode: draft.collectionNode,
    children: Array.from(draft.children.values()).sort(sortDrafts).map(toBranch),
  });

  if (root.collectionNode) {
    return [
      {
        key: "root",
        label: root.collectionNode.collection.name,
        relativePath: ".",
        collectionNode: root.collectionNode,
        children: Array.from(root.children.values()).sort(sortDrafts).map(toBranch),
      },
    ];
  }

  return Array.from(root.children.values()).sort(sortDrafts).map(toBranch);
}

export function App() {
  const repository = useMemo(() => createCollectionsRepository(), []);
  const transport = useMemo(() => createDesktopTransport(), []);

  const [envName, setEnvName] = useState("default");
  const [workspaceTree, setWorkspaceTree] = useState<WorkspaceTreeNode[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [newCollectionPath, setNewCollectionPath] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [activeCollectionIconEditor, setActiveCollectionIconEditor] = useState<string | null>(null);
  const [selectedIconId, setSelectedIconId] = useState(COLLECTION_ICON_OPTIONS[0]?.id ?? "folder");
  const [selectedAccentToken, setSelectedAccentToken] = useState("accent-1");

  const [themeName, setThemeName] = useState<ThemeName>("black");
  const [syncParamsWithUrl, setSyncParamsWithUrl] = useState(true);
  const [panelTab, setPanelTab] = useState<PanelTab>("body");
  const [responseTab, setResponseTab] = useState<ResponseTab>("response");

  const [method, setMethod] = useState<(typeof HTTP_METHODS)[number]>("GET");
  const [baseUrl, setBaseUrl] = useState("https://httpbin.org/get");
  const [queryRows, setQueryRows] = useState<KeyValueRow[]>([]);
  const [headerRows, setHeaderRows] = useState<KeyValueRow[]>([]);
  const [bearerToken, setBearerToken] = useState("");

  const [bodyMode, setBodyMode] = useState<BodyMode>("editor");
  const [payloadLanguage, setPayloadLanguage] = useState<PayloadLanguage>("json");
  const [editorBody, setEditorBody] = useState("");
  const [fileBody, setFileBody] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);

  const [responseText, setResponseText] = useState("No request executed yet.");
  const [statusText, setStatusText] = useState("idle");
  const [requestPreview, setRequestPreview] = useState("GET https://httpbin.org/get");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const accentPalette = ACCENTS_BY_THEME[themeName];
  const activeWorkspaceNode = useMemo(
    () =>
      workspaceTree.find((node) => node.workspace.id === activeWorkspaceId) ??
      workspaceTree[0] ??
      null,
    [workspaceTree, activeWorkspaceId],
  );
  const collectionTree = useMemo(
    () => (activeWorkspaceNode ? buildCollectionTree(activeWorkspaceNode.collections) : []),
    [activeWorkspaceNode],
  );

  async function refreshWorkspaceTree(locator?: SelectionLocator): Promise<WorkspaceTreeNode[]> {
    const tree = await repository.loadWorkspaceTree();
    setWorkspaceTree(tree);

    if (locator) {
      const nextSelection = findSelectionByLocator(tree, locator);
      setSelection(nextSelection);
      return tree;
    }

    if (selection) {
      const fallbackSelection = findSelectionByLocator(tree, {
        workspaceId: selection.workspace.id,
        collectionId: selection.collection.id,
        requestId: selection.request.id,
      });
      setSelection(fallbackSelection);
    }

    return tree;
  }

  useEffect(() => {
    repository.startSyncLoop();
    void (async () => {
      const tree = await repository.loadWorkspaceTree();
      setWorkspaceTree(tree);
    })();

    return () => {
      repository.stopSyncLoop();
    };
  }, [repository]);

  useEffect(() => {
    if (workspaceTree.length === 0) {
      setActiveWorkspaceId(null);
      return;
    }

    setActiveWorkspaceId((current) => {
      if (current && workspaceTree.some((entry) => entry.workspace.id === current)) {
        return current;
      }

      return workspaceTree[0]?.workspace.id ?? null;
    });
  }, [workspaceTree]);

  useEffect(() => {
    if (!selection || !activeWorkspaceNode) {
      return;
    }

    if (selection.workspace.id !== activeWorkspaceNode.workspace.id) {
      setSelection(null);
    }
  }, [selection, activeWorkspaceNode]);

  useEffect(() => {
    const onBeforeUnload = () => {
      void repository.flushSyncQueue();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [repository]);

  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      if (!selection) {
        setInlineCompletionEnvKeys([]);
        return;
      }

      try {
        const workspaceEnvText = await readCombinedEnv(
          (targetEnvName) =>
            repository.readWorkspaceEnvironment(selection.workspace.id, targetEnvName),
          envName,
        );
        const collectionEnvText = await readCombinedEnv(
          (targetEnvName) =>
            repository.readCollectionEnvironment(selection.collection.id, targetEnvName),
          envName,
        );
        const mergedEnv = mergeEnvironment(
          parseEnvText(workspaceEnvText),
          parseEnvText(collectionEnvText),
        );

        if (!isCancelled) {
          setInlineCompletionEnvKeys(Object.keys(mergedEnv));
        }
      } catch {
        if (!isCancelled) {
          setInlineCompletionEnvKeys([]);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [envName, repository, selection]);

  const computedBodyText = bodyMode === "file" ? fileBody : editorBody;

  const composedRequestText = useMemo(() => {
    return buildRequestText(method, baseUrl, queryRows, headerRows, bearerToken, computedBodyText);
  }, [method, baseUrl, queryRows, headerRows, bearerToken, computedBodyText]);

  const displayedUrl = syncParamsWithUrl ? buildUrl(baseUrl, queryRows) : baseUrl;

  async function onSelectRequest(nextSelection: Selection) {
    setSelection(nextSelection);
    setActiveWorkspaceId(nextSelection.workspace.id);

    const text = await repository.readRequestText(nextSelection.request.id);
    try {
      const parsed = parseHttpRequestText(text, nextSelection.request.title);

      const methodFromFile = parsed.method.toUpperCase();
      if (HTTP_METHODS.includes(methodFromFile as (typeof HTTP_METHODS)[number])) {
        setMethod(methodFromFile as (typeof HTTP_METHODS)[number]);
      }

      const { baseUrl: parsedBaseUrl, rows: parsedQueryRows } = parseQueryRows(parsed.url);
      setBaseUrl(parsedBaseUrl);
      setQueryRows(parsedQueryRows);

      const nextHeaders = { ...parsed.headers };
      const authHeader = nextHeaders.Authorization ?? nextHeaders.authorization;

      if (authHeader?.startsWith("Bearer ")) {
        setBearerToken(authHeader.slice("Bearer ".length).trim());
        delete nextHeaders.Authorization;
        delete nextHeaders.authorization;
      } else {
        setBearerToken("");
      }

      setHeaderRows(headersToRows(nextHeaders));

      const nextBody = parsed.body ?? "";
      setEditorBody(nextBody);
      setPayloadLanguage(detectPayloadLanguage(nextBody));
      setBodyMode("editor");
      setFileBody("");
      setFileName(null);
    } catch {
      // Keep UI editable even if the file doesn't follow strict parse format.
      setMethod("GET");
      setBaseUrl("https://httpbin.org/get");
      setQueryRows([]);
      setHeaderRows([]);
      setBearerToken("");
      setEditorBody(text);
      setPayloadLanguage(detectPayloadLanguage(text));
      setBodyMode("editor");
      setFileBody("");
      setFileName(null);
    }
  }

  function updateRow(
    rows: KeyValueRow[],
    rowId: string,
    updater: (row: KeyValueRow) => KeyValueRow,
  ): KeyValueRow[] {
    return rows.map((row) => (row.id === rowId ? updater(row) : row));
  }

  async function onBodyFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const contents = await file.text();
    setFileName(file.name);
    setFileBody(contents);
  }

  async function onCreateWorkspace() {
    try {
      const workspaceId = await repository.createWorkspace();
      if (!workspaceId) {
        return;
      }

      await refreshWorkspaceTree();
      setActiveWorkspaceId(workspaceId);
      setStatusText("workspace created");
      if (workspaceId.startsWith("workspace:editable:")) {
        pushToast("Workspace created in IndexedDB (filesystem API unavailable).", "info");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusText("error");
      pushToast(message);
    }
  }

  function startGitHubAuth(intent: "read" | "write"): void {
    const params = new URLSearchParams({
      intent,
      returnTo: `${window.location.pathname}${window.location.search}${window.location.hash}`,
    });
    window.location.assign(`/api/auth/github/start?${params.toString()}`);
  }

  async function onImportGitHubWorkspaces() {
    try {
      const result = await repository.importGitHubWorkspaces();
      if (result.requiresAuth) {
        startGitHubAuth("read");
        return;
      }

      if (result.imported === 0) {
        setStatusText("no github workspaces");
        pushToast("No GitHub workspaces found under .eshttp/workspaces.", "info");
        return;
      }

      await refreshWorkspaceTree();
      if (result.firstWorkspaceId) {
        setActiveWorkspaceId(result.firstWorkspaceId);
      }
      setStatusText(
        `imported ${result.imported} github workspace${result.imported === 1 ? "" : "s"}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusText("error");
      pushToast(message);
    }
  }

  async function onCreateCollection() {
    if (!activeWorkspaceNode) {
      setStatusText("error");
      pushToast("Create or select a workspace before adding a collection.");
      return;
    }

    const nextPath = newCollectionPath.trim();
    if (!nextPath) {
      setStatusText("error");
      pushToast("Collection path is required.");
      return;
    }

    try {
      const result = await repository.createCollection(activeWorkspaceNode.workspace.id, nextPath);
      await refreshWorkspaceTree();
      setActiveWorkspaceId(result.workspaceId);
      setNewCollectionPath("");
      setStatusText("collection created");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusText("error");
      pushToast(message);
    }
  }

  async function onCommitWorkspaceChanges() {
    if (!activeWorkspaceNode) {
      setStatusText("error");
      setResponseText("Select a workspace before committing.");
      setResponseTab("response");
      return;
    }

    try {
      const result = await repository.commitWorkspaceChanges(
        activeWorkspaceNode.workspace.id,
        commitMessage,
      );
      await refreshWorkspaceTree();
      setCommitMessage("");

      if (result.committedPaths === 0) {
        setStatusText("nothing to commit");
        setResponseText("No pending eshttp-tracked changes to commit.");
        setResponseTab("response");
        return;
      }

      const suffix = result.committedPaths === 1 ? "" : "s";
      setStatusText(`committed ${result.committedPaths} file${suffix}`);
      setResponseText(
        `Committed ${result.committedPaths} file${suffix} with message: ${result.message}`,
      );
      setResponseTab("response");
    } catch (error) {
      const fallbackMessage = error instanceof Error ? error.message : String(error);
      const errorWithMetadata = error as Error & { code?: string; reauthUrl?: string };
      if (errorWithMetadata.code === "GITHUB_REAUTH_REQUIRED" && errorWithMetadata.reauthUrl) {
        setStatusText("reauthentication required");
        setResponseText("Write access is required. Redirecting to GitHub authorization...");
        setResponseTab("response");
        window.location.assign(errorWithMetadata.reauthUrl);
        return;
      }

      const message = fallbackMessage;
      setStatusText("error");
      setResponseText(message);
      setResponseTab("response");
    }
  }

  async function onSaveRequest() {
    if (!selection) {
      setStatusText("error");
      pushToast("Select a request before saving.");
      return;
    }

    try {
      const updated = await repository.saveRequestText(selection.request.id, composedRequestText);
      const tree = await refreshWorkspaceTree(updated);
      const nextSelection = findSelectionByLocator(tree, updated);
      if (nextSelection) {
        await onSelectRequest(nextSelection);
      }

      setStatusText("saved");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusText("error");
      pushToast(message);
    }
  }

  async function onApplyCollectionIcon(collection: Collection) {
    try {
      const accent =
        accentPalette.find((entry) => entry.token === selectedAccentToken) ?? accentPalette[0];
      if (!accent) {
        return;
      }

      await repository.setCollectionIcon(collection.id, selectedIconId, accent.value);
      await refreshWorkspaceTree();
      setActiveCollectionIconEditor(null);
      setStatusText("icon updated");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusText("error");
      pushToast(message);
    }
  }

  async function onRunRequest() {
    try {
      setStatusText("running");
      setRequestPreview(composedRequestText);

      const workspaceEnvText = selection
        ? await readCombinedEnv(
            (targetEnvName) =>
              repository.readWorkspaceEnvironment(selection.workspace.id, targetEnvName),
            envName,
          )
        : "";

      const collectionEnvText = selection
        ? await readCombinedEnv(
            (targetEnvName) =>
              repository.readCollectionEnvironment(selection.collection.id, targetEnvName),
            envName,
          )
        : "";

      const built = buildRequest({
        title: selection?.request.title ?? "Ad hoc request",
        requestText: composedRequestText,
        workspaceEnvText,
        collectionEnvText,
      });

      const response = await transport.send({
        method: built.builtRequest.method,
        url: built.builtRequest.url,
        headers: built.builtRequest.headers,
        body: built.builtRequest.body,
      });

      setStatusText(`${response.status} ${response.statusText}`);
      setResponseText(response.body);
      setResponseTab("response");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusText("error");
      pushToast(message);
    }
  }

  function onUrlInputChange(nextValue: string) {
    if (!syncParamsWithUrl) {
      setBaseUrl(nextValue);
      return;
    }

    const { baseUrl: parsedBaseUrl, rows: parsedQueryRows } = parseQueryRows(nextValue);
    setBaseUrl(parsedBaseUrl);
    setQueryRows(parsedQueryRows);
  }

  function onSyncParamsWithUrlChange(enabled: boolean) {
    setSyncParamsWithUrl(enabled);
    if (!enabled || !baseUrl.includes("?")) {
      return;
    }

    const { baseUrl: parsedBaseUrl, rows: parsedQueryRows } = parseQueryRows(baseUrl);
    setBaseUrl(parsedBaseUrl);
    setQueryRows(parsedQueryRows);
  }

  const monacoTheme = MONACO_THEME_BY_APP_THEME[themeName];
  const mutedTextClass = "m-0 mt-[0.2rem] text-[0.86rem] text-content-muted";
  const panelShellClass =
    "overflow-hidden rounded-panel border border-stroke-default bg-[linear-gradient(180deg,var(--surface-primary),var(--surface-secondary))]";
  const sidebarPanelClass =
    "mb-[0.9rem] rounded-panel border border-stroke-default bg-[linear-gradient(170deg,var(--surface-secondary),var(--surface-tertiary))] p-[0.72rem]";
  const controlGridClass = "mb-[0.9rem] grid gap-[0.35rem] text-[0.9rem]";
  const subtleButtonClass =
    "w-full rounded-control border border-[color-mix(in_srgb,var(--stroke-accent)_50%,var(--stroke-default))] bg-[color-mix(in_srgb,var(--stroke-accent)_18%,var(--surface-tertiary))] px-[0.55rem] py-[0.45rem] text-content-primary disabled:cursor-not-allowed disabled:opacity-60";
  const controlSurfaceClass =
    "rounded-control border border-stroke-default bg-surface-secondary px-[0.55rem] py-[0.45rem] text-content-primary disabled:cursor-not-allowed disabled:opacity-60";
  const tabButtonClass =
    "rounded-control border border-stroke-default bg-transparent px-[0.62rem] py-[0.38rem] text-content-primary";
  const tabButtonActiveClass =
    "bg-surface-tertiary border-[color-mix(in_srgb,var(--stroke-accent)_40%,var(--stroke-default))]";
  const kvGridClass =
    "grid grid-cols-[1fr_1fr_74px_96px] items-center gap-[0.5rem] p-[0.72rem] max-[1080px]:grid-cols-1";
  const kvHeadClass = "text-[0.82rem] text-content-muted";
  const rowActionClass =
    "rounded-control border border-stroke-default bg-[color-mix(in_srgb,var(--state-danger)_40%,var(--surface-secondary))] px-[0.55rem] py-[0.45rem] text-content-primary";
  const addRowClass = cn(controlSurfaceClass, "col-span-2 max-[1080px]:col-span-1");
  const collectionControlButtonClass =
    "rounded-[6px] border border-stroke-default bg-surface-secondary px-[0.4rem] py-[0.2rem] text-[0.72rem] text-content-muted";
  const iconOptionClass =
    "grid place-items-center rounded-[6px] border border-stroke-default bg-surface-tertiary py-[0.3rem] text-content-primary";
  const editorBoxClass = "overflow-hidden rounded-[10px] border border-stroke-default";

  function pushToast(text: string, tone: ToastMessage["tone"] = "error") {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, tone, text }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((entry) => entry.id !== id));
    }, 3_200);
  }

  function renderCollectionBranch(branch: CollectionTreeBranch, workspace: Workspace) {
    const node = branch.collectionNode;
    const hasSelectedRequest = node?.requests.some(
      (request) => request.id === selection?.request.id,
    );

    return (
      <div key={`branch:${branch.key}`} className="grid gap-[0.36rem]">
        {node ? (
          <div className="rounded-tile border border-[color-mix(in_srgb,var(--stroke-default)_90%,transparent)] bg-[color-mix(in_srgb,var(--surface-secondary)_86%,transparent)] p-[0.45rem]">
            <div className="mb-[0.35rem] flex items-center justify-between gap-[0.4rem]">
              <h3 className="m-0 flex items-center gap-[0.4rem] text-[0.84rem] text-content-muted">
                {node.iconSvg ? (
                  <img
                    className="inline-block h-[14px] w-[14px]"
                    src={svgToDataUri(node.iconSvg)}
                    alt=""
                    aria-hidden
                  />
                ) : (
                  <span className="text-[0.78rem] text-stroke-accent" aria-hidden>
                    ◇
                  </span>
                )}
                {node.collection.name}
              </h3>
              <button
                type="button"
                className={collectionControlButtonClass}
                onClick={() =>
                  setActiveCollectionIconEditor((current) =>
                    current === node.collection.id ? null : node.collection.id,
                  )
                }
              >
                Icon
              </button>
            </div>
            {activeCollectionIconEditor === node.collection.id ? (
              <div className="mb-[0.45rem] mt-[0.15rem] rounded-control border border-stroke-default bg-surface-secondary p-[0.45rem]">
                <div className="mb-[0.4rem] grid grid-cols-8 gap-[0.22rem]">
                  {COLLECTION_ICON_OPTIONS.map((entry) => {
                    const Icon = entry.icon;
                    const isSelected = selectedIconId === entry.id;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        title={entry.label}
                        className={cn(
                          iconOptionClass,
                          isSelected &&
                            "border-[color-mix(in_srgb,var(--stroke-accent)_55%,var(--stroke-default))] bg-[color-mix(in_srgb,var(--stroke-accent)_18%,var(--surface-tertiary))]",
                        )}
                        onClick={() => setSelectedIconId(entry.id)}
                      >
                        <Icon size={18} weight="duotone" />
                      </button>
                    );
                  })}
                </div>
                <div className="mb-[0.4rem] grid grid-cols-5 gap-[0.26rem]">
                  {accentPalette.map((entry) => (
                    <button
                      key={entry.token}
                      type="button"
                      title={entry.label}
                      className={cn(
                        "h-[20px] w-full rounded-pill border border-stroke-default",
                        selectedAccentToken === entry.token &&
                          "shadow-[0_0_0_2px_color-mix(in_srgb,var(--stroke-accent)_45%,transparent)]",
                      )}
                      style={{ backgroundColor: entry.value }}
                      onClick={() => setSelectedAccentToken(entry.token)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="w-full rounded-[7px] border border-[color-mix(in_srgb,var(--stroke-accent)_50%,var(--stroke-default))] bg-[color-mix(in_srgb,var(--stroke-accent)_15%,var(--surface-tertiary))] px-[0.4rem] py-[0.34rem] text-[0.76rem] text-content-primary"
                  onClick={() => void onApplyCollectionIcon(node.collection)}
                >
                  Apply Icon
                </button>
              </div>
            ) : null}
            {node.requests.length === 0 ? (
              <p className="my-[0.28rem] text-[0.82rem] text-content-muted">No requests yet.</p>
            ) : null}
            {node.requests.map((request) => {
              const isSelected = selection?.request.id === request.id;
              return (
                <button
                  type="button"
                  key={request.id}
                  className={cn(
                    "mb-[0.35rem] w-full rounded-control border border-stroke-default bg-transparent px-[0.58rem] py-[0.46rem] text-left text-content-primary hover:bg-surface-tertiary",
                    isSelected &&
                      "border-[color-mix(in_srgb,var(--stroke-accent)_45%,var(--stroke-default))] bg-surface-active",
                  )}
                  onClick={() =>
                    void onSelectRequest({
                      workspace,
                      collection: node.collection,
                      request,
                    })
                  }
                >
                  {request.title}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="m-0 text-[0.78rem] uppercase tracking-[0.04em] text-content-muted">
            {branch.label}
          </p>
        )}

        {branch.children.length > 0 ? (
          <div
            className={cn(
              "ml-[0.55rem] grid gap-[0.36rem] border-l border-[color-mix(in_srgb,var(--stroke-default)_78%,transparent)] pl-[0.55rem]",
              hasSelectedRequest &&
                "border-l-[color-mix(in_srgb,var(--stroke-accent)_45%,var(--stroke-default))]",
            )}
          >
            {branch.children.map((child) => renderCollectionBranch(child, workspace))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="app-shell grid min-h-screen grid-cols-[78px_316px_1fr] bg-canvas max-[1080px]:grid-cols-1 max-[1080px]:grid-rows-[auto_auto_1fr]"
      data-theme={themeName}
    >
      <div
        className="pointer-events-none fixed right-[0.9rem] top-[0.9rem] z-30 grid gap-[0.45rem]"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "max-w-[min(80vw,420px)] rounded-tile border border-[color-mix(in_srgb,var(--stroke-default)_70%,transparent)] bg-[color-mix(in_srgb,var(--surface-secondary)_90%,#000)] px-[0.7rem] py-[0.55rem] text-[0.85rem] text-content-primary shadow-toast",
              toast.tone === "error" &&
                "border-[color-mix(in_srgb,var(--status-error)_55%,var(--stroke-default))] bg-[color-mix(in_srgb,#6b2828_24%,var(--surface-secondary))]",
            )}
          >
            {toast.text}
          </div>
        ))}
      </div>

      <aside className="flex flex-col items-center gap-[0.7rem] border-r border-stroke-default bg-[linear-gradient(190deg,var(--surface-primary),color-mix(in_srgb,var(--surface-secondary)_84%,#000))] px-[0.5rem] py-[0.72rem] max-[1080px]:flex-row max-[1080px]:justify-start max-[1080px]:overflow-x-auto max-[1080px]:border-b max-[1080px]:border-r-0 max-[1080px]:px-[0.52rem] max-[1080px]:py-[0.58rem]">
        <button
          type="button"
          className="h-[42px] w-[42px] rounded-panel border border-[color-mix(in_srgb,var(--stroke-accent)_52%,var(--stroke-default))] bg-[color-mix(in_srgb,var(--stroke-accent)_24%,var(--surface-tertiary))] text-[1.35rem] leading-none text-content-primary"
          title="Create workspace"
          aria-label="Create workspace"
          onClick={() => void onCreateWorkspace()}
        >
          +
        </button>
        <div className="grid w-full justify-items-center gap-[0.5rem] overflow-auto pb-[0.3rem] max-[1080px]:flex max-[1080px]:w-auto max-[1080px]:gap-[0.44rem] max-[1080px]:overflow-visible max-[1080px]:pb-0">
          {workspaceTree.map((tree) => {
            const isActive = activeWorkspaceNode?.workspace.id === tree.workspace.id;
            return (
              <button
                type="button"
                key={tree.workspace.id}
                className={cn(
                  "relative grid h-[42px] w-[42px] place-items-center rounded-[13px] border border-stroke-default bg-surface-secondary text-content-muted",
                  isActive &&
                    "border-[color-mix(in_srgb,var(--stroke-accent)_58%,var(--stroke-default))] bg-[color-mix(in_srgb,var(--stroke-accent)_20%,var(--surface-secondary))] text-content-primary",
                )}
                title={tree.workspace.name}
                onClick={() => setActiveWorkspaceId(tree.workspace.id)}
              >
                <span className="text-[0.64rem] font-bold tracking-[0.04em]">
                  {tree.workspace.name.slice(0, 2).toUpperCase()}
                </span>
                <span
                  className={cn(
                    "absolute bottom-[-3px] right-[-3px] h-[9px] w-[9px] rounded-pill border border-[color-mix(in_srgb,var(--stroke-default)_80%,transparent)] bg-[color-mix(in_srgb,var(--content-muted)_45%,transparent)]",
                    tree.syncState === "synced" &&
                      "bg-[color-mix(in_srgb,var(--status-success)_70%,var(--surface-tertiary))]",
                    tree.syncState === "pending" &&
                      "bg-[color-mix(in_srgb,var(--status-warning)_65%,var(--surface-tertiary))]",
                    tree.syncState === "error" &&
                      "bg-[color-mix(in_srgb,var(--status-error)_68%,var(--surface-tertiary))]",
                  )}
                />
              </button>
            );
          })}
        </div>
      </aside>

      <aside className="overflow-auto border-r border-stroke-default bg-[linear-gradient(170deg,var(--surface-primary),var(--surface-secondary))] px-[0.9rem] py-[1rem] max-[1080px]:max-h-[42vh] max-[1080px]:border-b max-[1080px]:border-r-0">
        <div className="mb-[1rem]">
          <div className="inline-flex items-center gap-[0.45rem]">
            <img src={appIcon} alt="" aria-hidden className="block h-[18px] w-[18px]" />
            <h1 className="m-0 text-[1.15rem] tracking-[0.02em]">eshttp</h1>
          </div>
          <p className={mutedTextClass}>Desktop HTTP Client</p>
          <button
            type="button"
            className={cn(subtleButtonClass, "mt-[0.7rem]")}
            onClick={() => void onCreateWorkspace()}
          >
            Create Workspace
          </button>
          <button
            type="button"
            className="import-button"
            onClick={() => void onImportGitHubWorkspaces()}
          >
            Import GitHub Workspaces
          </button>

          {activeWorkspaceNode ? (
            <>
              <div className="mt-[0.66rem] flex items-baseline justify-between gap-[0.4rem]">
                <h2 className="m-0 text-[0.95rem]">{activeWorkspaceNode.workspace.name}</h2>
                <div className="inline-flex gap-[0.3rem]">
                  <span
                    className={cn(
                      "rounded-pill border border-stroke-default px-[0.44rem] py-[0.1rem] text-[0.7rem] uppercase tracking-[0.04em]",
                      activeWorkspaceNode.mode === "readonly" && "text-content-muted",
                      activeWorkspaceNode.mode === "editable" && "text-stroke-accent",
                    )}
                  >
                    {activeWorkspaceNode.mode}
                  </span>
                  <span
                    className={cn(
                      "rounded-pill border border-stroke-default px-[0.44rem] py-[0.1rem] text-[0.7rem] uppercase tracking-[0.04em]",
                      activeWorkspaceNode.syncState === "pending" &&
                        "text-[color-mix(in_srgb,var(--stroke-accent)_60%,var(--content-primary))]",
                      activeWorkspaceNode.syncState === "error" && "text-status-error",
                    )}
                  >
                    {activeWorkspaceNode.syncState}
                  </span>
                </div>
              </div>
              {activeWorkspaceNode.supportsCommit ? (
                <div className="mt-[0.68rem] grid gap-[0.48rem]">
                  <p className="m-0 text-[0.78rem] text-content-muted">
                    {activeWorkspaceNode.storageKind === "github"
                      ? "GitHub backend"
                      : "Git storage"}{" "}
                    · {activeWorkspaceNode.pendingGitChanges} pending
                  </p>
                  <InlineMonacoInput
                    className="[--inline-input-bg:var(--surface-tertiary)]"
                    value={commitMessage}
                    onChange={setCommitMessage}
                    placeholder="Commit message (optional)"
                    theme={monacoTheme}
                    beforeMount={registerMonacoThemes}
                    ariaLabel="Git commit message"
                  />
                  <button
                    type="button"
                    className="w-full rounded-control border border-[color-mix(in_srgb,var(--stroke-accent)_50%,var(--stroke-default))] bg-[color-mix(in_srgb,var(--stroke-accent)_14%,var(--surface-tertiary))] px-[0.54rem] py-[0.42rem] text-content-primary"
                    onClick={() => void onCommitWorkspaceChanges()}
                  >
                    {activeWorkspaceNode.storageKind === "github"
                      ? "Commit to GitHub"
                      : "Commit Changes"}
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p className={mutedTextClass}>No workspaces yet.</p>
          )}
        </div>

        <section className={sidebarPanelClass}>
          <h2 className="mb-[0.56rem] mt-0 text-[0.9rem]">Create Collection</h2>
          <div className="grid gap-[0.5rem]">
            <input
              className="rounded-control border border-stroke-default bg-surface-tertiary px-[0.58rem] py-[0.45rem] text-content-primary disabled:cursor-not-allowed disabled:opacity-60"
              value={newCollectionPath}
              onChange={(event) => setNewCollectionPath(event.target.value)}
              placeholder="api/users"
              aria-label="Collection path"
              disabled={!activeWorkspaceNode}
            />
            <button
              type="button"
              className={cn(subtleButtonClass, "mt-0")}
              onClick={() => void onCreateCollection()}
              disabled={!activeWorkspaceNode}
            >
              Create Collection
            </button>
          </div>
        </section>

        <section className={sidebarPanelClass}>
          <h2 className="mb-[0.7rem] mt-0 text-[0.9rem]">Settings</h2>
          <div className={controlGridClass}>
            <p className="m-0">Environment</p>
            <InlineMonacoInput
              className="[--inline-input-bg:var(--surface-tertiary)]"
              value={envName}
              onChange={setEnvName}
              placeholder="default"
              theme={monacoTheme}
              beforeMount={registerMonacoThemes}
              ariaLabel="Environment"
            />
          </div>
          <label className={cn(controlGridClass, "mb-[0.6rem]")}>
            Theme
            <select
              className="rounded-control border border-stroke-default bg-surface-tertiary px-[0.58rem] py-[0.42rem] text-content-primary"
              value={themeName}
              onChange={(event) => {
                setThemeName(event.target.value as ThemeName);
                setSelectedAccentToken("accent-1");
              }}
            >
              <option value="black">Black</option>
              <option value="light">Light</option>
              <option value="soft">Soft</option>
              <option value="gruvbox">Gruvbox</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-[0.45rem] text-[0.85rem] text-content-muted">
            <input
              className="m-0 h-[16px] w-[16px] accent-stroke-accent"
              type="checkbox"
              checked={syncParamsWithUrl}
              onChange={(event) => onSyncParamsWithUrlChange(event.target.checked)}
            />
            Sync params with URL
          </label>
        </section>

        <div className="grid gap-[0.42rem]">
          {activeWorkspaceNode ? (
            collectionTree.length > 0 ? (
              collectionTree.map((branch) =>
                renderCollectionBranch(branch, activeWorkspaceNode.workspace),
              )
            ) : (
              <p className="my-[0.28rem] text-[0.82rem] text-content-muted">No collections yet.</p>
            )
          ) : (
            <p className="my-[0.28rem] text-[0.82rem] text-content-muted">
              Create a workspace to start.
            </p>
          )}
        </div>
      </aside>

      <main className="grid min-h-screen grid-rows-[auto_1fr_1fr] gap-[0.78rem] p-[0.9rem] max-[1080px]:grid-rows-[auto_auto_auto]">
        <header className="grid grid-cols-[112px_1fr_94px_94px] items-center gap-[0.6rem] max-[1080px]:grid-cols-2">
          <select
            className={controlSurfaceClass}
            value={method}
            onChange={(event) => setMethod(event.target.value as (typeof HTTP_METHODS)[number])}
          >
            {HTTP_METHODS.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>

          <InlineMonacoInput
            className="font-mono max-[1080px]:col-span-2"
            value={displayedUrl}
            onChange={onUrlInputChange}
            placeholder="https://api.example.com/v1/resource"
            theme={monacoTheme}
            beforeMount={registerMonacoThemes}
            ariaLabel="Request URL"
          />

          <button
            type="button"
            className="rounded-control border border-[color-mix(in_srgb,var(--stroke-accent)_55%,var(--stroke-default))] bg-stroke-accent px-[0.55rem] py-[0.45rem] font-semibold text-content-on-accent"
            onClick={() => void onRunRequest()}
          >
            Send
          </button>
          <button
            type="button"
            className="rounded-control border border-[color-mix(in_srgb,var(--stroke-accent)_40%,var(--stroke-default))] bg-[color-mix(in_srgb,var(--stroke-accent)_18%,var(--surface-secondary))] px-[0.55rem] py-[0.45rem] font-semibold text-content-primary"
            onClick={() => void onSaveRequest()}
          >
            Save
          </button>
        </header>

        <section className={panelShellClass}>
          <nav className="flex gap-[0.45rem] border-b border-stroke-default p-[0.7rem]">
            <button
              type="button"
              className={cn(tabButtonClass, panelTab === "params" && tabButtonActiveClass)}
              onClick={() => setPanelTab("params")}
            >
              Params
            </button>
            <button
              type="button"
              className={cn(tabButtonClass, panelTab === "headers" && tabButtonActiveClass)}
              onClick={() => setPanelTab("headers")}
            >
              Headers
            </button>
            <button
              type="button"
              className={cn(tabButtonClass, panelTab === "auth" && tabButtonActiveClass)}
              onClick={() => setPanelTab("auth")}
            >
              Auth
            </button>
            <button
              type="button"
              className={cn(tabButtonClass, panelTab === "body" && tabButtonActiveClass)}
              onClick={() => setPanelTab("body")}
            >
              Body
            </button>
          </nav>

          {panelTab === "params" ? (
            <div className={kvGridClass}>
              <div className={kvHeadClass}>Key</div>
              <div className={kvHeadClass}>Value</div>
              <div className={kvHeadClass}>Enabled</div>
              <div />

              {queryRows.map((row) => (
                <div className="contents" key={row.id}>
                  <InlineMonacoInput
                    value={row.key}
                    onChange={(nextValue) =>
                      setQueryRows((current) =>
                        updateRow(current, row.id, (target) => ({
                          ...target,
                          key: nextValue,
                        })),
                      )
                    }
                    placeholder="limit"
                    theme={monacoTheme}
                    beforeMount={registerMonacoThemes}
                    ariaLabel="Query parameter key"
                  />
                  <InlineMonacoInput
                    value={row.value}
                    onChange={(nextValue) =>
                      setQueryRows((current) =>
                        updateRow(current, row.id, (target) => ({
                          ...target,
                          value: nextValue,
                        })),
                      )
                    }
                    placeholder="10"
                    theme={monacoTheme}
                    beforeMount={registerMonacoThemes}
                    ariaLabel="Query parameter value"
                  />
                  <input
                    className="mx-auto h-[18px] w-[18px] accent-stroke-accent"
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(event) =>
                      setQueryRows((current) =>
                        updateRow(current, row.id, (target) => ({
                          ...target,
                          enabled: event.target.checked,
                        })),
                      )
                    }
                  />
                  <button
                    type="button"
                    className={rowActionClass}
                    onClick={() =>
                      setQueryRows((current) => current.filter((entry) => entry.id !== row.id))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}

              <button
                type="button"
                className={addRowClass}
                onClick={() => setQueryRows((current) => [...current, createRow()])}
              >
                Add Param
              </button>
            </div>
          ) : null}

          {panelTab === "headers" ? (
            <div className={kvGridClass}>
              <div className={kvHeadClass}>Key</div>
              <div className={kvHeadClass}>Value</div>
              <div className={kvHeadClass}>Enabled</div>
              <div />

              {headerRows.map((row) => (
                <div className="contents" key={row.id}>
                  <InlineMonacoInput
                    value={row.key}
                    onChange={(nextValue) =>
                      setHeaderRows((current) =>
                        updateRow(current, row.id, (target) => ({
                          ...target,
                          key: nextValue,
                        })),
                      )
                    }
                    placeholder="Content-Type"
                    theme={monacoTheme}
                    beforeMount={registerMonacoThemes}
                    ariaLabel="Header key"
                  />
                  <InlineMonacoInput
                    value={row.value}
                    onChange={(nextValue) =>
                      setHeaderRows((current) =>
                        updateRow(current, row.id, (target) => ({
                          ...target,
                          value: nextValue,
                        })),
                      )
                    }
                    placeholder="application/json"
                    theme={monacoTheme}
                    beforeMount={registerMonacoThemes}
                    ariaLabel="Header value"
                  />
                  <input
                    className="mx-auto h-[18px] w-[18px] accent-stroke-accent"
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(event) =>
                      setHeaderRows((current) =>
                        updateRow(current, row.id, (target) => ({
                          ...target,
                          enabled: event.target.checked,
                        })),
                      )
                    }
                  />
                  <button
                    type="button"
                    className={rowActionClass}
                    onClick={() =>
                      setHeaderRows((current) => current.filter((entry) => entry.id !== row.id))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}

              <button
                type="button"
                className={addRowClass}
                onClick={() => setHeaderRows((current) => [...current, createRow()])}
              >
                Add Header
              </button>
            </div>
          ) : null}

          {panelTab === "auth" ? (
            <div className="p-[0.72rem]">
              <div className={controlGridClass}>
                <p className="m-0">Bearer Token</p>
                <InlineMonacoInput
                  className="[--inline-input-bg:var(--surface-tertiary)]"
                  value={bearerToken}
                  onChange={setBearerToken}
                  placeholder="Paste JWT or access token"
                  theme={monacoTheme}
                  beforeMount={registerMonacoThemes}
                  ariaLabel="Bearer token"
                />
              </div>
            </div>
          ) : null}

          {panelTab === "body" ? (
            <div className="p-[0.72rem]">
              <div className="mb-[0.66rem] flex items-center gap-[0.85rem]">
                <label className="inline-flex items-center gap-[0.35rem] text-content-muted">
                  <input
                    className="accent-stroke-accent"
                    type="radio"
                    checked={bodyMode === "editor"}
                    onChange={() => setBodyMode("editor")}
                  />
                  Monaco Editor
                </label>
                <label className="inline-flex items-center gap-[0.35rem] text-content-muted">
                  <input
                    className="accent-stroke-accent"
                    type="radio"
                    checked={bodyMode === "file"}
                    onChange={() => setBodyMode("file")}
                  />
                  File Upload
                </label>

                <select
                  className={controlSurfaceClass}
                  value={payloadLanguage}
                  onChange={(event) => setPayloadLanguage(event.target.value as PayloadLanguage)}
                  disabled={bodyMode !== "editor"}
                >
                  <option value="json">JSON</option>
                  <option value="graphql">GraphQL</option>
                </select>
              </div>

              {bodyMode === "editor" ? (
                <div className={editorBoxClass}>
                  <Editor
                    height="360px"
                    theme={monacoTheme}
                    beforeMount={registerMonacoThemes}
                    language={payloadLanguage}
                    value={editorBody}
                    onChange={(value) => setEditorBody(value ?? "")}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      tabSize: 2,
                      automaticLayout: true,
                    }}
                  />
                </div>
              ) : (
                <div className="rounded-[10px] border border-stroke-default bg-surface-tertiary p-[0.8rem]">
                  <input
                    className={controlSurfaceClass}
                    type="file"
                    onChange={(event) => void onBodyFileSelect(event)}
                  />
                  <p className="mb-0 mt-[0.55rem] text-[0.86rem] text-content-muted">
                    {fileName ? `Attached: ${fileName}` : "No file attached"}
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </section>

        <section className={panelShellClass}>
          <div className="flex items-center justify-between border-b border-stroke-default">
            <nav className="flex gap-[0.45rem] p-[0.55rem_0.7rem]">
              <button
                type="button"
                className={cn(tabButtonClass, responseTab === "request" && tabButtonActiveClass)}
                onClick={() => setResponseTab("request")}
              >
                Request
              </button>
              <button
                type="button"
                className={cn(tabButtonClass, responseTab === "response" && tabButtonActiveClass)}
                onClick={() => setResponseTab("response")}
              >
                Response
              </button>
            </nav>
            <p className="m-0 pr-[0.8rem] font-semibold text-content-muted">{statusText}</p>
          </div>

          {responseTab === "request" ? (
            <pre className="m-0 h-[calc(100%-49px)] overflow-auto whitespace-pre-wrap break-words p-[0.8rem] font-mono text-[0.86rem]">
              {requestPreview}
            </pre>
          ) : (
            <pre className="m-0 h-[calc(100%-49px)] overflow-auto whitespace-pre-wrap break-words p-[0.8rem] font-mono text-[0.86rem]">
              {responseText}
            </pre>
          )}
        </section>
      </main>
    </div>
  );
}
