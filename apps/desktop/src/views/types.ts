import type { Collection, RequestFile, Workspace } from "@eshttp/core";
import type { WorkspaceTreeNode } from "../data/collectionsRepository";

export type ThemeName = "black" | "light" | "soft" | "gruvbox";
export type BodyMode = "editor" | "file";
export type PayloadLanguage = "json" | "graphql";
export type PanelTab = "params" | "headers" | "auth" | "body";
export type ResponseTab = "request" | "response";

export interface Option<T extends string> {
  value: T;
  label: string;
}

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const PANEL_TAB_OPTIONS = [
  { value: "params", label: "Params" },
  { value: "headers", label: "Headers" },
  { value: "auth", label: "Auth" },
  { value: "body", label: "Body" },
] as const satisfies ReadonlyArray<Option<PanelTab>>;

export const RESPONSE_TAB_OPTIONS = [
  { value: "request", label: "Request" },
  { value: "response", label: "Response" },
] as const satisfies ReadonlyArray<Option<ResponseTab>>;

export const BODY_MODE_OPTIONS = [
  { value: "editor", label: "Monaco Editor" },
  { value: "file", label: "File Upload" },
] as const satisfies ReadonlyArray<Option<BodyMode>>;

export const PAYLOAD_LANGUAGE_OPTIONS = [
  { value: "json", label: "JSON" },
  { value: "graphql", label: "GraphQL" },
] as const satisfies ReadonlyArray<Option<PayloadLanguage>>;

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
