import type { Collection, Workspace } from "@eshttp/core";
import { COLLECTION_ICON_OPTIONS, svgToDataUri } from "../data/collectionIcons";
import type { AccentOption, CollectionTreeBranch, Selection } from "../views/types";
import { Button } from "./Button";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

interface CollectionTreeProps {
  branches: CollectionTreeBranch[];
  workspace: Workspace;
  selection: Selection | null;
  activeCollectionIconEditor: string | null;
  selectedIconId: string;
  selectedAccentToken: string;
  accentPalette: AccentOption[];
  onToggleCollectionIconEditor: (collectionId: string) => void;
  onSelectIconId: (iconId: string) => void;
  onSelectAccentToken: (token: string) => void;
  onApplyCollectionIcon: (collection: Collection) => void;
  onSelectRequest: (selection: Selection) => void;
}

export function CollectionTree({
  branches,
  workspace,
  selection,
  activeCollectionIconEditor,
  selectedIconId,
  selectedAccentToken,
  accentPalette,
  onToggleCollectionIconEditor,
  onSelectIconId,
  onSelectAccentToken,
  onApplyCollectionIcon,
  onSelectRequest,
}: CollectionTreeProps) {
  function renderCollectionBranch(branch: CollectionTreeBranch) {
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
              <Button
                variant="secondary"
                size="xs"
                className="text-content-muted"
                onClick={() => onToggleCollectionIconEditor(node.collection.id)}
              >
                Icon
              </Button>
            </div>
            {activeCollectionIconEditor === node.collection.id ? (
              <div className="mb-[0.45rem] mt-[0.15rem] rounded-control border border-stroke-default bg-surface-secondary p-[0.45rem]">
                <div className="mb-[0.4rem] grid grid-cols-8 gap-[0.22rem]">
                  {COLLECTION_ICON_OPTIONS.map((entry) => {
                    const Icon = entry.icon;
                    const isSelected = selectedIconId === entry.id;
                    return (
                      <Button
                        key={entry.id}
                        variant="secondary"
                        size="none"
                        title={entry.label}
                        className={cn(
                          "grid place-items-center rounded-[6px] border border-stroke-default bg-surface-tertiary py-[0.3rem] text-content-primary",
                          isSelected &&
                            "border-[color-mix(in_srgb,var(--stroke-accent)_55%,var(--stroke-default))] bg-[color-mix(in_srgb,var(--stroke-accent)_18%,var(--surface-tertiary))]",
                        )}
                        onClick={() => onSelectIconId(entry.id)}
                      >
                        <Icon size={18} weight="duotone" />
                      </Button>
                    );
                  })}
                </div>
                <div className="mb-[0.4rem] grid grid-cols-5 gap-[0.26rem]">
                  {accentPalette.map((entry) => (
                    <Button
                      key={entry.token}
                      variant="ghost"
                      size="none"
                      title={entry.label}
                      className={cn(
                        "h-[20px] w-full rounded-pill border border-stroke-default hover:bg-transparent",
                        selectedAccentToken === entry.token &&
                          "shadow-[0_0_0_2px_color-mix(in_srgb,var(--stroke-accent)_45%,transparent)]",
                      )}
                      style={{ backgroundColor: entry.value }}
                      onClick={() => onSelectAccentToken(entry.token)}
                    />
                  ))}
                </div>
                <Button
                  variant="accent"
                  size="sm"
                  className="w-full"
                  onClick={() => onApplyCollectionIcon(node.collection)}
                >
                  Apply Icon
                </Button>
              </div>
            ) : null}
            {node.requests.length === 0 ? (
              <p className="my-[0.28rem] text-[0.82rem] text-content-muted">No requests yet.</p>
            ) : null}
            {node.requests.map((request) => {
              const isSelected = selection?.request.id === request.id;
              return (
                <Button
                  variant="ghost"
                  size="none"
                  key={request.id}
                  className={cn(
                    "mb-[0.35rem] w-full justify-start rounded-control px-[0.58rem] py-[0.46rem] text-left",
                    isSelected &&
                      "border-[color-mix(in_srgb,var(--stroke-accent)_45%,var(--stroke-default))] bg-surface-active",
                  )}
                  onClick={() =>
                    onSelectRequest({
                      workspace,
                      collection: node.collection,
                      request,
                    })
                  }
                >
                  {request.title}
                </Button>
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
            {branch.children.map((child) => renderCollectionBranch(child))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-[0.42rem]">
      {branches.map((branch) => renderCollectionBranch(branch))}
    </div>
  );
}
