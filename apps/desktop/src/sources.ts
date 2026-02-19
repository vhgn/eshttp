import type { Collection, CollectionSource, RequestFile, Workspace } from "@eshttp/core";
import { invokeTauri, isTauriRuntime } from "./runtime";

export class TauriCollectionSource implements CollectionSource {
  readonly kind = "tauri-fs";

  async listWorkspaces(): Promise<Workspace[]> {
    return invokeTauri("list_workspaces");
  }

  async discoverCollections(workspace: Workspace): Promise<Collection[]> {
    return invokeTauri("discover_collections", { workspace });
  }

  async listRequests(collection: Collection): Promise<RequestFile[]> {
    return invokeTauri("list_requests", { collection });
  }

  async readRequestText(request: RequestFile): Promise<string> {
    return invokeTauri("read_request_text", { request });
  }

  async readEnvironmentFile(scopeUri: string, envName: string): Promise<string | null> {
    return invokeTauri("read_environment_file", { scopeUri, envName });
  }
}

const demoWorkspace: Workspace = {
  id: "workspace:demo",
  name: "demo",
  uri: "memory://demo",
};

const demoCollection: Collection = {
  id: "collection:demo/default",
  workspaceId: demoWorkspace.id,
  name: "default",
  uri: "memory://demo/default",
};

const demoRequest: RequestFile = {
  id: "request:demo/get",
  collectionId: demoCollection.id,
  title: "Get ip",
  uri: "memory://demo/default/Get ip.http",
};

export class BrowserDemoSource implements CollectionSource {
  readonly kind = "browser-demo";

  async listWorkspaces(): Promise<Workspace[]> {
    return [demoWorkspace];
  }

  async discoverCollections(_workspace: Workspace): Promise<Collection[]> {
    return [demoCollection];
  }

  async listRequests(_collection: Collection): Promise<RequestFile[]> {
    return [demoRequest];
  }

  async readRequestText(_request: RequestFile): Promise<string> {
    return "GET https://httpbin.org/ip";
  }

  async readEnvironmentFile(_scopeUri: string, envName: string): Promise<string | null> {
    if (envName === "default") {
      return "";
    }

    return null;
  }
}

export function createCollectionSource(): CollectionSource {
  if (isTauriRuntime()) {
    return new TauriCollectionSource();
  }

  return new BrowserDemoSource();
}
