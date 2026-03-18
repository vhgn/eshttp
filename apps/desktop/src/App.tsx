import { buildRequest, mergeEnvironment, parseEnvText } from "@eshttp/core";
import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { ToastStack } from "./components/ToastStack";
import { WorkspaceRail } from "./components/WorkspaceRail";
import { COLLECTION_ICON_OPTIONS } from "./data/collectionIcons";
import { createCollectionsRepository, type WorkspaceTreeNode } from "./data/collectionsRepository";
import {
  addDraftRow,
  composeRequestText,
  createDefaultRequestDraft,
  getDisplayedUrl,
  parseRequestTextToDraft,
  removeDraftRow,
  setDraftSyncParamsWithUrl,
  updateDraftRow,
  updateDraftUrl,
} from "./requestDraft";
import { setInlineCompletionEnvKeys } from "./monaco/inlineLanguage";
import { APP_THEME_CONFIG, registerMonacoThemes } from "./themeConfig";
import { createDesktopTransport } from "./transports";
import { RequestWorkbenchView } from "./views/RequestWorkbenchView";
import type {
  CollectionTreeBranch,
  PanelTab,
  ResponseTab,
  Selection,
  ThemeName,
  ToastMessage,
} from "./views/types";
import { WorkspaceSidebarView } from "./views/WorkspaceSidebarView";

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
  const [panelTab, setPanelTab] = useState<PanelTab>("body");
  const [responseTab, setResponseTab] = useState<ResponseTab>("response");
  const [draft, setDraft] = useState(createDefaultRequestDraft);

  const [responseText, setResponseText] = useState("No request executed yet.");
  const [statusText, setStatusText] = useState("idle");
  const [requestPreview, setRequestPreview] = useState(() =>
    composeRequestText(createDefaultRequestDraft()),
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const {
    method,
    queryRows,
    headerRows,
    bearerToken,
    bodyMode,
    payloadLanguage,
    editorBody,
    fileName,
    syncParamsWithUrl,
  } = draft;

  const activeTheme = APP_THEME_CONFIG[themeName];
  const accentPalette = activeTheme.accents;
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

  const composedRequestText = useMemo(() => {
    return composeRequestText(draft);
  }, [draft]);

  const displayedUrl = getDisplayedUrl(draft);

  async function onSelectRequest(nextSelection: Selection) {
    setSelection(nextSelection);
    setActiveWorkspaceId(nextSelection.workspace.id);

    const text = await repository.readRequestText(nextSelection.request.id);
    setDraft(parseRequestTextToDraft(text, nextSelection.request.title));
  }

  async function onBodyFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const contents = await file.text();
    setDraft((current) => ({
      ...current,
      fileName: file.name,
      fileBody: contents,
    }));
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
    setDraft((current) => updateDraftUrl(current, nextValue));
  }

  function onSyncParamsWithUrlChange(enabled: boolean) {
    setDraft((current) => setDraftSyncParamsWithUrl(current, enabled));
  }

  const monacoTheme = activeTheme.monacoTheme;

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

  function updateQueryRowValue(rowId: string, nextValue: Partial<(typeof queryRows)[number]>) {
    setDraft((current) => updateDraftRow(current, "queryRows", rowId, nextValue));
  }

  function updateHeaderRowValue(rowId: string, nextValue: Partial<(typeof headerRows)[number]>) {
    setDraft((current) => updateDraftRow(current, "headerRows", rowId, nextValue));
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
        method={draft.method}
        displayedUrl={displayedUrl}
        panelTab={panelTab}
        responseTab={responseTab}
        queryRows={draft.queryRows}
        headerRows={draft.headerRows}
        bearerToken={draft.bearerToken}
        bodyMode={draft.bodyMode}
        payloadLanguage={draft.payloadLanguage}
        editorBody={draft.editorBody}
        fileName={draft.fileName}
        statusText={statusText}
        requestPreview={requestPreview}
        responseText={responseText}
        onMethodChange={(method) => setDraft((current) => ({ ...current, method }))}
        onUrlChange={onUrlInputChange}
        onRunRequest={() => void onRunRequest()}
        onSaveRequest={() => void onSaveRequest()}
        onPanelTabChange={setPanelTab}
        onResponseTabChange={setResponseTab}
        onQueryRowChange={updateQueryRowValue}
        onHeaderRowChange={updateHeaderRowValue}
        onAddQueryRow={() => setDraft((current) => addDraftRow(current, "queryRows"))}
        onAddHeaderRow={() => setDraft((current) => addDraftRow(current, "headerRows"))}
        onRemoveQueryRow={(rowId) =>
          setDraft((current) => removeDraftRow(current, "queryRows", rowId))
        }
        onRemoveHeaderRow={(rowId) =>
          setDraft((current) => removeDraftRow(current, "headerRows", rowId))
        }
        onBearerTokenChange={(bearerToken) => setDraft((current) => ({ ...current, bearerToken }))}
        onBodyModeChange={(bodyMode) => setDraft((current) => ({ ...current, bodyMode }))}
        onPayloadLanguageChange={(payloadLanguage) =>
          setDraft((current) => ({ ...current, payloadLanguage }))
        }
        onEditorBodyChange={(editorBody) => setDraft((current) => ({ ...current, editorBody }))}
        onBodyFileSelect={(event) => void onBodyFileSelect(event)}
      />
    </div>
  );
}
