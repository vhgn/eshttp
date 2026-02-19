import type { WorkspaceTreeNode } from "../data/collectionsRepository";
import { Button } from "./Button";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

interface WorkspaceRailProps {
  workspaceTree: WorkspaceTreeNode[];
  activeWorkspaceId: string | null;
  onCreateWorkspace: () => void;
  onSelectWorkspace: (workspaceId: string) => void;
}

export function WorkspaceRail({
  workspaceTree,
  activeWorkspaceId,
  onCreateWorkspace,
  onSelectWorkspace,
}: WorkspaceRailProps) {
  return (
    <aside className="flex flex-col items-center gap-[0.7rem] border-r border-stroke-default bg-[linear-gradient(190deg,var(--surface-primary),color-mix(in_srgb,var(--surface-secondary)_84%,#000))] px-[0.5rem] py-[0.72rem] max-[1080px]:flex-row max-[1080px]:justify-start max-[1080px]:overflow-x-auto max-[1080px]:border-b max-[1080px]:border-r-0 max-[1080px]:px-[0.52rem] max-[1080px]:py-[0.58rem]">
      <Button
        variant="accent"
        size="icon"
        className="border-[color-mix(in_srgb,var(--stroke-accent)_52%,var(--stroke-default))] bg-[color-mix(in_srgb,var(--stroke-accent)_24%,var(--surface-tertiary))]"
        title="Create workspace"
        aria-label="Create workspace"
        onClick={onCreateWorkspace}
      >
        +
      </Button>
      <div className="grid w-full justify-items-center gap-[0.5rem] overflow-auto pb-[0.3rem] max-[1080px]:flex max-[1080px]:w-auto max-[1080px]:gap-[0.44rem] max-[1080px]:overflow-visible max-[1080px]:pb-0">
        {workspaceTree.map((tree) => {
          const isActive = activeWorkspaceId === tree.workspace.id;
          return (
            <Button
              variant="secondary"
              size="none"
              key={tree.workspace.id}
              className={cn(
                "relative grid h-[42px] w-[42px] place-items-center rounded-[13px] border border-stroke-default bg-surface-secondary text-content-muted",
                isActive &&
                  "border-[color-mix(in_srgb,var(--stroke-accent)_58%,var(--stroke-default))] bg-[color-mix(in_srgb,var(--stroke-accent)_20%,var(--surface-secondary))] text-content-primary",
              )}
              title={tree.workspace.name}
              onClick={() => onSelectWorkspace(tree.workspace.id)}
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
            </Button>
          );
        })}
      </div>
    </aside>
  );
}
