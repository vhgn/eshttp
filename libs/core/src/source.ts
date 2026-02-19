import {
  type Collection,
  CollectionSchema,
  type RequestFile,
  RequestSchema,
  type Workspace,
  WorkspaceSchema,
} from "./schemas";

export interface CollectionSource {
  readonly kind: string;
  listWorkspaces(): Promise<Workspace[]>;
  discoverCollections(workspace: Workspace): Promise<Collection[]>;
  listRequests(collection: Collection): Promise<RequestFile[]>;
  readRequestText(request: RequestFile): Promise<string>;
  readEnvironmentFile(scopeUri: string, envName: string): Promise<string | null>;
}

export function validateWorkspace(value: unknown): Workspace {
  return WorkspaceSchema.parse(value);
}

export function validateCollection(value: unknown): Collection {
  return CollectionSchema.parse(value);
}

export function validateRequestFile(value: unknown): RequestFile {
  return RequestSchema.parse(value);
}
