import { buildRequest, mergeEnvironment, parseEnvText, parseHttpRequestText } from "@eshttp/core";
import type Editor from "@monaco-editor/react";
import type { ChangeEvent, ComponentProps } from "react";
import { useEffect, useMemo, useState } from "react";
import { ToastStack } from "./components/ToastStack";
import { WorkspaceRail } from "./components/WorkspaceRail";
import { COLLECTION_ICON_OPTIONS } from "./data/collectionIcons";
import { createCollectionsRepository, type WorkspaceTreeNode } from "./data/collectionsRepository";
import { registerInlineLanguage, setInlineCompletionEnvKeys } from "./monaco/inlineLanguage";
import { createDesktopTransport } from "./transports";
import { RequestWorkbenchView } from "./views/RequestWorkbenchView";
import type {
  AccentOption,
  BodyMode,
  CollectionTreeBranch,
  HttpMethod,
  KeyValueRow,
  PanelTab,
  PayloadLanguage,
  ResponseTab,
  Selection,
  ThemeName,
  ToastMessage,
} from "./views/types";
import { HTTP_METHODS } from "./views/types";
import { WorkspaceSidebarView } from "./views/WorkspaceSidebarView";

type Monaco = Parameters<NonNullable<ComponentProps<typeof Editor>["beforeMount"]>>[0];
const MONACO_THEME_BY_APP_THEME: Record<ThemeName, string> = {
  black: "eshttp-black",
  light: "eshttp-light",
  soft: "eshttp-soft",
  gruvbox: "eshttp-gruvbox",
};
const ACCENTS_BY_THEME: Record<ThemeName, AccentOption[]> = {
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

  const [method, setMethod] = useState<HttpMethod>("GET");
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
      if (HTTP_METHODS.includes(methodFromFile as HttpMethod)) {
        setMethod(methodFromFile as HttpMethod);
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
        setStatusText("workspace creation canceled");
        pushToast("Workspace creation was canceled.", "info");
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

  async function onApplyCollectionIcon(collectionId: string) {
    try {
      const accent =
        accentPalette.find((entry) => entry.token === selectedAccentToken) ?? accentPalette[0];
      if (!accent) {
        return;
      }

      await repository.setCollectionIcon(collectionId, selectedIconId, accent.value);
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

  function pushToast(text: string, tone: ToastMessage["tone"] = "error") {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, tone, text }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((entry) => entry.id !== id));
    }, 3_200);
  }

  function onThemeChange(nextTheme: ThemeName) {
    setThemeName(nextTheme);
    setSelectedAccentToken("accent-1");
  }

  function updateQueryRowValue(
    rowId: string,
    nextValue: Partial<Pick<KeyValueRow, "key" | "value" | "enabled">>,
  ) {
    setQueryRows((current) =>
      updateRow(current, rowId, (target) => ({
        ...target,
        ...nextValue,
      })),
    );
  }

  function updateHeaderRowValue(
    rowId: string,
    nextValue: Partial<Pick<KeyValueRow, "key" | "value" | "enabled">>,
  ) {
    setHeaderRows((current) =>
      updateRow(current, rowId, (target) => ({
        ...target,
        ...nextValue,
      })),
    );
  }

  return (
    <div
      className="app-shell grid min-h-screen grid-cols-[78px_316px_1fr] bg-canvas max-[1080px]:grid-cols-1 max-[1080px]:grid-rows-[auto_auto_1fr]"
      data-theme={themeName}
    >
      <ToastStack toasts={toasts} />
      <WorkspaceRail
        workspaceTree={workspaceTree}
        activeWorkspaceId={activeWorkspaceNode?.workspace.id ?? null}
        onCreateWorkspace={() => void onCreateWorkspace()}
        onSelectWorkspace={setActiveWorkspaceId}
      />
      <WorkspaceSidebarView
        activeWorkspaceNode={activeWorkspaceNode}
        collectionTree={collectionTree}
        selection={selection}
        activeCollectionIconEditor={activeCollectionIconEditor}
        selectedIconId={selectedIconId}
        selectedAccentToken={selectedAccentToken}
        accentPalette={accentPalette}
        commitMessage={commitMessage}
        newCollectionPath={newCollectionPath}
        envName={envName}
        themeName={themeName}
        syncParamsWithUrl={syncParamsWithUrl}
        monacoTheme={monacoTheme}
        beforeMountMonaco={registerMonacoThemes}
        onCreateWorkspace={() => void onCreateWorkspace()}
        onImportGitHubWorkspaces={() => void onImportGitHubWorkspaces()}
        onCommitWorkspaceChanges={() => void onCommitWorkspaceChanges()}
        onCreateCollection={() => void onCreateCollection()}
        onSelectRequest={(nextSelection) => void onSelectRequest(nextSelection)}
        onNewCollectionPathChange={setNewCollectionPath}
        onCommitMessageChange={setCommitMessage}
        onEnvNameChange={setEnvName}
        onThemeChange={onThemeChange}
        onSyncParamsWithUrlChange={onSyncParamsWithUrlChange}
        onToggleCollectionIconEditor={(collectionId) =>
          setActiveCollectionIconEditor((current) =>
            current === collectionId ? null : collectionId,
          )
        }
        onSelectIconId={setSelectedIconId}
        onSelectAccentToken={setSelectedAccentToken}
        onApplyCollectionIcon={(collectionId) => void onApplyCollectionIcon(collectionId)}
      />
      <RequestWorkbenchView
        monacoTheme={monacoTheme}
        beforeMountMonaco={registerMonacoThemes}
        method={method}
        displayedUrl={displayedUrl}
        panelTab={panelTab}
        responseTab={responseTab}
        queryRows={queryRows}
        headerRows={headerRows}
        bearerToken={bearerToken}
        bodyMode={bodyMode}
        payloadLanguage={payloadLanguage}
        editorBody={editorBody}
        fileName={fileName}
        statusText={statusText}
        requestPreview={requestPreview}
        responseText={responseText}
        onMethodChange={setMethod}
        onUrlChange={onUrlInputChange}
        onRunRequest={() => void onRunRequest()}
        onSaveRequest={() => void onSaveRequest()}
        onPanelTabChange={setPanelTab}
        onResponseTabChange={setResponseTab}
        onQueryRowChange={updateQueryRowValue}
        onHeaderRowChange={updateHeaderRowValue}
        onAddQueryRow={() => setQueryRows((current) => [...current, createRow()])}
        onAddHeaderRow={() => setHeaderRows((current) => [...current, createRow()])}
        onRemoveQueryRow={(rowId) =>
          setQueryRows((current) => current.filter((entry) => entry.id !== rowId))
        }
        onRemoveHeaderRow={(rowId) =>
          setHeaderRows((current) => current.filter((entry) => entry.id !== rowId))
        }
        onBearerTokenChange={setBearerToken}
        onBodyModeChange={setBodyMode}
        onPayloadLanguageChange={setPayloadLanguage}
        onEditorBodyChange={setEditorBody}
        onBodyFileSelect={(event) => void onBodyFileSelect(event)}
      />
    </div>
  );
}
