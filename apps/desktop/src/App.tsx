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
      const message = error instanceof Error ? error.message : String(error);
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
      <div key={`branch:${branch.key}`} className="collection-branch">
        {node ? (
          <div className="collection-card">
            <div className="collection-head">
              <h3>
                {node.iconSvg ? (
                  <img
                    className="collection-icon"
                    src={svgToDataUri(node.iconSvg)}
                    alt=""
                    aria-hidden
                  />
                ) : (
                  <span className="collection-icon-fallback" aria-hidden>
                    ◇
                  </span>
                )}
                {node.collection.name}
              </h3>
              <button
                type="button"
                className="collection-icon-action"
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
              <div className="icon-picker">
                <div className="icon-grid">
                  {COLLECTION_ICON_OPTIONS.map((entry) => {
                    const Icon = entry.icon;
                    const isSelected = selectedIconId === entry.id;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        title={entry.label}
                        className={isSelected ? "icon-option selected" : "icon-option"}
                        onClick={() => setSelectedIconId(entry.id)}
                      >
                        <Icon size={18} weight="duotone" />
                      </button>
                    );
                  })}
                </div>
                <div className="color-grid">
                  {accentPalette.map((entry) => (
                    <button
                      key={entry.token}
                      type="button"
                      title={entry.label}
                      className={
                        selectedAccentToken === entry.token
                          ? "accent-option selected"
                          : "accent-option"
                      }
                      style={{ backgroundColor: entry.value }}
                      onClick={() => setSelectedAccentToken(entry.token)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="apply-icon"
                  onClick={() => void onApplyCollectionIcon(node.collection)}
                >
                  Apply Icon
                </button>
              </div>
            ) : null}
            {node.requests.length === 0 ? <p className="tree-empty">No requests yet.</p> : null}
            {node.requests.map((request) => {
              const isSelected = selection?.request.id === request.id;
              return (
                <button
                  type="button"
                  key={request.id}
                  className={isSelected ? "request-button selected" : "request-button"}
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
          <p className="tree-branch-label">{branch.label}</p>
        )}

        {branch.children.length > 0 ? (
          <div
            className={
              hasSelectedRequest
                ? "tree-branch-children tree-branch-children-selected"
                : "tree-branch-children"
            }
          >
            {branch.children.map((child) => renderCollectionBranch(child, workspace))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="app-shell" data-theme={themeName}>
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={toast.tone === "error" ? "toast toast-error" : "toast"}>
            {toast.text}
          </div>
        ))}
      </div>

      <aside className="workspace-rail">
        <button
          type="button"
          className="workspace-create"
          title="Create workspace"
          aria-label="Create workspace"
          onClick={() => void onCreateWorkspace()}
        >
          +
        </button>
        <div className="workspace-list">
          {workspaceTree.map((tree) => {
            const isActive = activeWorkspaceNode?.workspace.id === tree.workspace.id;
            return (
              <button
                type="button"
                key={tree.workspace.id}
                className={isActive ? "workspace-pill active" : "workspace-pill"}
                title={tree.workspace.name}
                onClick={() => setActiveWorkspaceId(tree.workspace.id)}
              >
                <span className="workspace-pill-name">
                  {tree.workspace.name.slice(0, 2).toUpperCase()}
                </span>
                <span className={`workspace-pill-sync ${tree.syncState}`} />
              </button>
            );
          })}
        </div>
      </aside>

      <aside className="sidebar">
        <div className="sidebar-head">
          <div className="app-brand">
            <img src={appIcon} alt="" aria-hidden className="app-brand-icon" />
            <h1>eshttp</h1>
          </div>
          <p className="muted">Desktop HTTP Client</p>
          <button type="button" className="import-button" onClick={() => void onCreateWorkspace()}>
            Create Workspace
          </button>

          {activeWorkspaceNode ? (
            <>
              <div className="workspace-head">
                <h2>{activeWorkspaceNode.workspace.name}</h2>
                <div className="workspace-tags">
                  <span className={`tag ${activeWorkspaceNode.mode}`}>
                    {activeWorkspaceNode.mode}
                  </span>
                  <span className={`tag ${activeWorkspaceNode.syncState}`}>
                    {activeWorkspaceNode.syncState}
                  </span>
                </div>
              </div>
              {activeWorkspaceNode.supportsCommit ? (
                <div className="git-commit-panel">
                  <p className="git-commit-meta">
                    Git storage · {activeWorkspaceNode.pendingGitChanges} pending
                  </p>
                  <InlineMonacoInput
                    value={commitMessage}
                    onChange={setCommitMessage}
                    placeholder="Commit message (optional)"
                    theme={monacoTheme}
                    beforeMount={registerMonacoThemes}
                    ariaLabel="Git commit message"
                  />
                  <button
                    type="button"
                    className="git-commit-button"
                    onClick={() => void onCommitWorkspaceChanges()}
                  >
                    Commit Changes
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="muted">No workspaces yet.</p>
          )}
        </div>

        <section className="collection-create-panel">
          <h2>Create Collection</h2>
          <div className="collection-create">
            <input
              value={newCollectionPath}
              onChange={(event) => setNewCollectionPath(event.target.value)}
              placeholder="api/users"
              aria-label="Collection path"
              disabled={!activeWorkspaceNode}
            />
            <button
              type="button"
              className="import-button"
              onClick={() => void onCreateCollection()}
              disabled={!activeWorkspaceNode}
            >
              Create Collection
            </button>
          </div>
        </section>

        <section className="settings-panel">
          <h2>Settings</h2>
          <div className="control">
            <p className="control-label">Environment</p>
            <InlineMonacoInput
              value={envName}
              onChange={setEnvName}
              placeholder="default"
              theme={monacoTheme}
              beforeMount={registerMonacoThemes}
              ariaLabel="Environment"
            />
          </div>
          <label className="control">
            Theme
            <select
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
          <label className="setting-toggle">
            <input
              type="checkbox"
              checked={syncParamsWithUrl}
              onChange={(event) => onSyncParamsWithUrlChange(event.target.checked)}
            />
            Sync params with URL
          </label>
        </section>

        <div className="tree">
          {activeWorkspaceNode ? (
            collectionTree.length > 0 ? (
              collectionTree.map((branch) =>
                renderCollectionBranch(branch, activeWorkspaceNode.workspace),
              )
            ) : (
              <p className="tree-empty">No collections yet.</p>
            )
          ) : (
            <p className="tree-empty">Create a workspace to start.</p>
          )}
        </div>
      </aside>

      <main className="content">
        <header className="request-bar">
          <select
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
            className="url-input"
            value={displayedUrl}
            onChange={onUrlInputChange}
            placeholder="https://api.example.com/v1/resource"
            theme={monacoTheme}
            beforeMount={registerMonacoThemes}
            ariaLabel="Request URL"
          />

          <button type="button" className="send" onClick={() => void onRunRequest()}>
            Send
          </button>
          <button type="button" className="save" onClick={() => void onSaveRequest()}>
            Save
          </button>
        </header>

        <section className="request-panel">
          <nav className="tabs">
            <button
              type="button"
              className={panelTab === "params" ? "active" : undefined}
              onClick={() => setPanelTab("params")}
            >
              Params
            </button>
            <button
              type="button"
              className={panelTab === "headers" ? "active" : undefined}
              onClick={() => setPanelTab("headers")}
            >
              Headers
            </button>
            <button
              type="button"
              className={panelTab === "auth" ? "active" : undefined}
              onClick={() => setPanelTab("auth")}
            >
              Auth
            </button>
            <button
              type="button"
              className={panelTab === "body" ? "active" : undefined}
              onClick={() => setPanelTab("body")}
            >
              Body
            </button>
          </nav>

          {panelTab === "params" ? (
            <div className="kv-grid">
              <div className="kv-head">Key</div>
              <div className="kv-head">Value</div>
              <div className="kv-head">Enabled</div>
              <div />

              {queryRows.map((row) => (
                <div className="kv-row" key={row.id}>
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
                    className="row-action"
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
                className="add-row"
                onClick={() => setQueryRows((current) => [...current, createRow()])}
              >
                Add Param
              </button>
            </div>
          ) : null}

          {panelTab === "headers" ? (
            <div className="kv-grid">
              <div className="kv-head">Key</div>
              <div className="kv-head">Value</div>
              <div className="kv-head">Enabled</div>
              <div />

              {headerRows.map((row) => (
                <div className="kv-row" key={row.id}>
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
                    className="row-action"
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
                className="add-row"
                onClick={() => setHeaderRows((current) => [...current, createRow()])}
              >
                Add Header
              </button>
            </div>
          ) : null}

          {panelTab === "auth" ? (
            <div className="auth-panel">
              <div className="control">
                <p className="control-label">Bearer Token</p>
                <InlineMonacoInput
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
            <div className="body-panel">
              <div className="body-controls">
                <label>
                  <input
                    type="radio"
                    checked={bodyMode === "editor"}
                    onChange={() => setBodyMode("editor")}
                  />
                  Monaco Editor
                </label>
                <label>
                  <input
                    type="radio"
                    checked={bodyMode === "file"}
                    onChange={() => setBodyMode("file")}
                  />
                  File Upload
                </label>

                <select
                  value={payloadLanguage}
                  onChange={(event) => setPayloadLanguage(event.target.value as PayloadLanguage)}
                  disabled={bodyMode !== "editor"}
                >
                  <option value="json">JSON</option>
                  <option value="graphql">GraphQL</option>
                </select>
              </div>

              {bodyMode === "editor" ? (
                <div className="editor-shell">
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
                <div className="file-shell">
                  <input type="file" onChange={(event) => void onBodyFileSelect(event)} />
                  <p>{fileName ? `Attached: ${fileName}` : "No file attached"}</p>
                </div>
              )}
            </div>
          ) : null}
        </section>

        <section className="response-panel">
          <div className="response-top">
            <nav className="tabs">
              <button
                type="button"
                className={responseTab === "request" ? "active" : undefined}
                onClick={() => setResponseTab("request")}
              >
                Request
              </button>
              <button
                type="button"
                className={responseTab === "response" ? "active" : undefined}
                onClick={() => setResponseTab("response")}
              >
                Response
              </button>
            </nav>
            <p className="status">{statusText}</p>
          </div>

          {responseTab === "request" ? <pre>{requestPreview}</pre> : <pre>{responseText}</pre>}
        </section>
      </main>
    </div>
  );
}
