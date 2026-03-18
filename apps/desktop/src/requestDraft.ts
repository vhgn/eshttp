import { parseHttpRequestText } from "@eshttp/core";
import type { BodyMode, HttpMethod, KeyValueRow, PayloadLanguage } from "./views/types";
import { HTTP_METHODS } from "./views/types";

export interface RequestDraftState {
  method: HttpMethod;
  baseUrl: string;
  queryRows: KeyValueRow[];
  headerRows: KeyValueRow[];
  bearerToken: string;
  bodyMode: BodyMode;
  payloadLanguage: PayloadLanguage;
  editorBody: string;
  fileBody: string;
  fileName: string | null;
  syncParamsWithUrl: boolean;
}

type RequestDraftRowField = "queryRows" | "headerRows";
type RequestDraftRowPatch = Partial<Pick<KeyValueRow, "key" | "value" | "enabled">>;

const DEFAULT_BASE_URL = "https://httpbin.org/get";

export function createDraftRow(partial?: Partial<KeyValueRow>): KeyValueRow {
  return {
    id: crypto.randomUUID(),
    key: partial?.key ?? "",
    value: partial?.value ?? "",
    enabled: partial?.enabled ?? true,
  };
}

export function createDefaultRequestDraft(): RequestDraftState {
  return {
    method: "GET",
    baseUrl: DEFAULT_BASE_URL,
    queryRows: [],
    headerRows: [],
    bearerToken: "",
    bodyMode: "editor",
    payloadLanguage: "json",
    editorBody: "",
    fileBody: "",
    fileName: null,
    syncParamsWithUrl: true,
  };
}

export function parseQueryRows(url: string): { baseUrl: string; rows: KeyValueRow[] } {
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

      return createDraftRow({
        key: decodeSafe(rawKey),
        value: decodeSafe(rawValue),
        enabled: true,
      });
    });

  return { baseUrl, rows };
}

export function buildUrl(baseUrl: string, params: KeyValueRow[]): string {
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
  return Object.entries(headers).map(([key, value]) =>
    createDraftRow({ key, value, enabled: true }),
  );
}

export function detectPayloadLanguage(value: string | undefined): PayloadLanguage {
  if (!value) {
    return "json";
  }

  const trimmed = value.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return "json";
  }

  return "graphql";
}

export function getDraftBodyText(draft: RequestDraftState): string {
  return draft.bodyMode === "file" ? draft.fileBody : draft.editorBody;
}

export function getDisplayedUrl(draft: RequestDraftState): string {
  return draft.syncParamsWithUrl ? buildUrl(draft.baseUrl, draft.queryRows) : draft.baseUrl;
}

export function composeRequestText(draft: RequestDraftState): string {
  const url = buildUrl(draft.baseUrl, draft.queryRows);
  const mergedHeaders = rowsToHeaderMap(draft.headerRows);
  const bodyText = getDraftBodyText(draft);

  if (draft.bearerToken.trim()) {
    mergedHeaders.Authorization = `Bearer ${draft.bearerToken.trim()}`;
  }

  const headerLines = Object.entries(mergedHeaders).map(([key, value]) => `${key}: ${value}`);
  const firstLine = `${draft.method} ${url}`;

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

export function parseRequestTextToDraft(text: string, title: string): RequestDraftState {
  try {
    const parsed = parseHttpRequestText(text, title);
    const draft = createDefaultRequestDraft();
    const method = HTTP_METHODS.includes(parsed.method.toUpperCase() as HttpMethod)
      ? (parsed.method.toUpperCase() as HttpMethod)
      : draft.method;
    const { baseUrl, rows } = parseQueryRows(parsed.url);
    const nextHeaders = { ...parsed.headers };
    const authHeader = nextHeaders.Authorization ?? nextHeaders.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    if (bearerToken) {
      delete nextHeaders.Authorization;
      delete nextHeaders.authorization;
    }

    const nextBody = parsed.body ?? "";

    return {
      ...draft,
      method,
      baseUrl,
      queryRows: rows,
      headerRows: headersToRows(nextHeaders),
      bearerToken,
      payloadLanguage: detectPayloadLanguage(nextBody),
      editorBody: nextBody,
    };
  } catch {
    return {
      ...createDefaultRequestDraft(),
      editorBody: text,
      payloadLanguage: detectPayloadLanguage(text),
    };
  }
}

export function updateDraftUrl(draft: RequestDraftState, nextValue: string): RequestDraftState {
  if (!draft.syncParamsWithUrl) {
    return {
      ...draft,
      baseUrl: nextValue,
    };
  }

  const { baseUrl, rows } = parseQueryRows(nextValue);
  return {
    ...draft,
    baseUrl,
    queryRows: rows,
  };
}

export function setDraftSyncParamsWithUrl(
  draft: RequestDraftState,
  enabled: boolean,
): RequestDraftState {
  if (!enabled || !draft.baseUrl.includes("?")) {
    return {
      ...draft,
      syncParamsWithUrl: enabled,
    };
  }

  const { baseUrl, rows } = parseQueryRows(draft.baseUrl);
  return {
    ...draft,
    syncParamsWithUrl: enabled,
    baseUrl,
    queryRows: rows,
  };
}

export function updateDraftRow(
  draft: RequestDraftState,
  field: RequestDraftRowField,
  rowId: string,
  nextValue: RequestDraftRowPatch,
): RequestDraftState {
  return {
    ...draft,
    [field]: draft[field].map((row) => (row.id === rowId ? { ...row, ...nextValue } : row)),
  };
}

export function addDraftRow(
  draft: RequestDraftState,
  field: RequestDraftRowField,
): RequestDraftState {
  return {
    ...draft,
    [field]: [...draft[field], createDraftRow()],
  };
}

export function removeDraftRow(
  draft: RequestDraftState,
  field: RequestDraftRowField,
  rowId: string,
): RequestDraftState {
  return {
    ...draft,
    [field]: draft[field].filter((row) => row.id !== rowId),
  };
}
