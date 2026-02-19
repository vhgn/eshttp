import type { Collection, RequestFile, Workspace } from "@eshttp/core";
import type { WorkspaceTreeNode } from "../data/collectionsRepository";

export type ThemeName = "black" | "light" | "soft" | "gruvbox";
export type BodyMode = "editor" | "file";
export type PayloadLanguage = "json" | "graphql";
export type PanelTab = "params" | "headers" | "auth" | "body";
export type ResponseTab = "request" | "response";

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface Selection {
  workspace: Workspace;
  collection: Collection;
  request: RequestFile;
}

export interface CollectionTreeBranch {
  key: string;
  label: string;
  relativePath: string;
  collectionNode: WorkspaceTreeNode["collections"][number] | null;
  children: CollectionTreeBranch[];
}

export interface KeyValueRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface ToastMessage {
  id: string;
  tone: "error" | "info";
  text: string;
}

export interface AccentOption {
  token: string;
  label: string;
  value: string;
}
