import type Editor from "@monaco-editor/react";
import type { ComponentProps } from "react";
import appIcon from "../../src-tauri/icons/icon.png";
import { Button } from "../components/Button";
import { CollectionTree } from "../components/CollectionTree";
import { InlineMonacoInput } from "../components/InlineMonacoInput";
import type { WorkspaceTreeNode } from "../data/collectionsRepository";
import type { AccentOption, CollectionTreeBranch, Selection, ThemeName } from "./types";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

interface WorkspaceSidebarViewProps {
  activeWorkspaceNode: WorkspaceTreeNode | null;
  collectionTree: CollectionTreeBranch[];
  selection: Selection | null;
  activeCollectionIconEditor: string | null;
  selectedIconId: string;
  selectedAccentToken: string;
  accentPalette: AccentOption[];
  commitMessage: string;
  newCollectionPath: string;
  envName: string;
  themeName: ThemeName;
  syncParamsWithUrl: boolean;
  monacoTheme: string;
  beforeMountMonaco: ComponentProps<typeof Editor>["beforeMount"];
  onCreateWorkspace: () => void;
  onImportGitHubWorkspaces: () => void;
  onCommitWorkspaceChanges: () => void;
  onCreateCollection: () => void;
  onSelectRequest: (selection: Selection) => void;
  onNewCollectionPathChange: (value: string) => void;
  onCommitMessageChange: (value: string) => void;
  onEnvNameChange: (value: string) => void;
  onThemeChange: (themeName: ThemeName) => void;
  onSyncParamsWithUrlChange: (enabled: boolean) => void;
  onToggleCollectionIconEditor: (collectionId: string) => void;
  onSelectIconId: (iconId: string) => void;
  onSelectAccentToken: (token: string) => void;
  onApplyCollectionIcon: (collectionId: string) => void;
}

export function WorkspaceSidebarView({
  activeWorkspaceNode,
  collectionTree,
  selection,
  activeCollectionIconEditor,
  selectedIconId,
  selectedAccentToken,
  accentPalette,
  commitMessage,
  newCollectionPath,
  envName,
  themeName,
  syncParamsWithUrl,
  monacoTheme,
  beforeMountMonaco,
  onCreateWorkspace,
  onImportGitHubWorkspaces,
  onCommitWorkspaceChanges,
  onCreateCollection,
  onSelectRequest,
  onNewCollectionPathChange,
  onCommitMessageChange,
  onEnvNameChange,
  onThemeChange,
  onSyncParamsWithUrlChange,
  onToggleCollectionIconEditor,
  onSelectIconId,
  onSelectAccentToken,
  onApplyCollectionIcon,
}: WorkspaceSidebarViewProps) {
  const mutedTextClass = "m-0 mt-[0.2rem] text-[0.86rem] text-content-muted";
  const sidebarPanelClass =
    "mb-[0.9rem] rounded-panel border border-stroke-default bg-[linear-gradient(170deg,var(--surface-secondary),var(--surface-tertiary))] p-[0.72rem]";
  const controlGridClass = "mb-[0.9rem] grid gap-[0.35rem] text-[0.9rem]";

  return (
    <aside className="overflow-auto border-r border-stroke-default bg-[linear-gradient(170deg,var(--surface-primary),var(--surface-secondary))] px-[0.9rem] py-[1rem] max-[1080px]:max-h-[42vh] max-[1080px]:border-b max-[1080px]:border-r-0">
      <div className="mb-[1rem]">
        <div className="inline-flex items-center gap-[0.45rem]">
          <img src={appIcon} alt="" aria-hidden className="block h-[18px] w-[18px]" />
          <h1 className="m-0 text-[1.15rem] tracking-[0.02em]">eshttp</h1>
        </div>
        <p className={mutedTextClass}>Desktop HTTP Client</p>
        <Button variant="accent" className="mt-[0.7rem] w-full" onClick={onCreateWorkspace}>
          Create Workspace
        </Button>
        <Button variant="accent" className="mt-[0.42rem] w-full" onClick={onImportGitHubWorkspaces}>
          Import GitHub Workspaces
        </Button>

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
                  {activeWorkspaceNode.storageKind === "github" ? "GitHub backend" : "Git storage"}{" "}
                  · {activeWorkspaceNode.pendingGitChanges} pending
                </p>
                <InlineMonacoInput
                  className="[--inline-input-bg:var(--surface-tertiary)]"
                  value={commitMessage}
                  onChange={onCommitMessageChange}
                  placeholder="Commit message (optional)"
                  theme={monacoTheme}
                  beforeMount={beforeMountMonaco}
                  ariaLabel="Git commit message"
                />
                <Button variant="accent" className="w-full" onClick={onCommitWorkspaceChanges}>
                  {activeWorkspaceNode.storageKind === "github"
                    ? "Commit to GitHub"
                    : "Commit Changes"}
                </Button>
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
            onChange={(event) => onNewCollectionPathChange(event.target.value)}
            placeholder="api/users"
            aria-label="Collection path"
            disabled={!activeWorkspaceNode}
          />
          <Button
            variant="accent"
            className="mt-0 w-full"
            onClick={onCreateCollection}
            disabled={!activeWorkspaceNode}
          >
            Create Collection
          </Button>
        </div>
      </section>

      <section className={sidebarPanelClass}>
        <h2 className="mb-[0.7rem] mt-0 text-[0.9rem]">Settings</h2>
        <div className={controlGridClass}>
          <p className="m-0">Environment</p>
          <InlineMonacoInput
            className="[--inline-input-bg:var(--surface-tertiary)]"
            value={envName}
            onChange={onEnvNameChange}
            placeholder="default"
            theme={monacoTheme}
            beforeMount={beforeMountMonaco}
            ariaLabel="Environment"
          />
        </div>
        <label className={cn(controlGridClass, "mb-[0.6rem]")}>
          Theme
          <select
            className="rounded-control border border-stroke-default bg-surface-tertiary px-[0.58rem] py-[0.42rem] text-content-primary"
            value={themeName}
            onChange={(event) => onThemeChange(event.target.value as ThemeName)}
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

      {activeWorkspaceNode ? (
        collectionTree.length > 0 ? (
          <CollectionTree
            branches={collectionTree}
            workspace={activeWorkspaceNode.workspace}
            selection={selection}
            activeCollectionIconEditor={activeCollectionIconEditor}
            selectedIconId={selectedIconId}
            selectedAccentToken={selectedAccentToken}
            accentPalette={accentPalette}
            onToggleCollectionIconEditor={onToggleCollectionIconEditor}
            onSelectIconId={onSelectIconId}
            onSelectAccentToken={onSelectAccentToken}
            onApplyCollectionIcon={(collection) => onApplyCollectionIcon(collection.id)}
            onSelectRequest={onSelectRequest}
          />
        ) : (
          <p className="my-[0.28rem] text-[0.82rem] text-content-muted">No collections yet.</p>
        )
      ) : (
        <p className="my-[0.28rem] text-[0.82rem] text-content-muted">
          Create a workspace to start.
        </p>
      )}
    </aside>
  );
}
