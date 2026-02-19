import type { Collection, RequestFile, Workspace } from "./schemas";
import type { CollectionSource } from "./source";

export interface WorkspaceTree {
  workspace: Workspace;
  collections: Array<{
    collection: Collection;
    requests: RequestFile[];
  }>;
}

export async function loadWorkspaceTree(source: CollectionSource): Promise<WorkspaceTree[]> {
  const workspaces = await source.listWorkspaces();
  const trees: WorkspaceTree[] = [];

  for (const workspace of workspaces) {
    const collections = await source.discoverCollections(workspace);
    const collectionNodes: WorkspaceTree["collections"] = [];

    for (const collection of collections) {
      const requests = await source.listRequests(collection);
      collectionNodes.push({ collection, requests });
    }

    trees.push({
      workspace,
      collections: collectionNodes,
    });
  }

  return trees;
}
