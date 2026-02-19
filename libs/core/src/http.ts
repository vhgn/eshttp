import { EshttpError, MissingEnvVariablesError } from "./errors";
import {
  type ParsedHttpRequest,
  ParsedHttpRequestSchema,
  type ResolvedHttpRequest,
  ResolvedHttpRequestSchema,
} from "./schemas";

const PLACEHOLDER_PATTERN = /\{\{\s*([A-Z0-9_]+)\s*\}\}/g;

function normalizeText(input: string): string {
  return input.replace(/\r\n/g, "\n").trim();
}

function parseRequestLine(line: string): { method: string; url: string } {
  const trimmed = line.trim();
  const match = trimmed.match(/^([A-Z]+)\s+(.+)$/);

  if (!match) {
    throw new EshttpError(
      "REQUEST_PARSE_ERROR",
      `Invalid request line: ${line}. Expected: METHOD <url>`,
    );
  }

  const method = match[1];
  const url = match[2];
  if (!method || !url) {
    throw new EshttpError(
      "REQUEST_PARSE_ERROR",
      `Invalid request line: ${line}. Expected: METHOD <url>`,
    );
  }

  return {
    method,
    url: url.trim(),
  };
}

function parseHeaderLine(line: string): { key: string; value: string } {
  const separatorIndex = line.indexOf(":");
  if (separatorIndex <= 0) {
    throw new EshttpError(
      "REQUEST_PARSE_ERROR",
      `Invalid header line: ${line}. Expected: Header-Name: value`,
    );
  }

  const key = line.slice(0, separatorIndex).trim();
  const value = line.slice(separatorIndex + 1).trim();
  return { key, value };
}

export function parseHttpRequestText(text: string, title: string): ParsedHttpRequest {
  const normalized = normalizeText(text);
  if (!normalized) {
    throw new EshttpError("REQUEST_PARSE_ERROR", "Request file is empty.");
  }

  const lines = normalized.split("\n");

  let currentLineIndex = 0;
  while (currentLineIndex < lines.length) {
    const candidate = lines[currentLineIndex];
    if (candidate === undefined) {
      break;
    }

    const trimmedCandidate = candidate.trim();
    if (!trimmedCandidate || trimmedCandidate.startsWith("#")) {
      currentLineIndex += 1;
      continue;
    }
    break;
  }

  if (currentLineIndex >= lines.length) {
    throw new EshttpError("REQUEST_PARSE_ERROR", "No request line found in file.");
  }

  const requestLine = lines[currentLineIndex];
  if (requestLine === undefined) {
    throw new EshttpError("REQUEST_PARSE_ERROR", "No request line found in file.");
  }

  const { method, url } = parseRequestLine(requestLine);
  currentLineIndex += 1;

  const headers: Record<string, string> = {};
  while (currentLineIndex < lines.length) {
    const line = lines[currentLineIndex];
    if (line === undefined) {
      break;
    }

    if (line.trim() === "") {
      currentLineIndex += 1;
      break;
    }

    const { key, value } = parseHeaderLine(line);
    headers[key] = value;
    currentLineIndex += 1;
  }

  const bodyLines = lines.slice(currentLineIndex);
  const body = bodyLines.length > 0 ? bodyLines.join("\n") : undefined;

  const parsed = ParsedHttpRequestSchema.safeParse({
    title,
    method,
    url,
    headers,
    body,
  });

  if (!parsed.success) {
    throw new EshttpError(
      "REQUEST_VALIDATION_ERROR",
      parsed.error.issues.map((issue) => issue.message).join("; "),
    );
  }

  return parsed.data;
}

function collectMissingPlaceholders(
  template: string,
  environment: Record<string, string>,
): string[] {
  const missing = new Set<string>();

  template.replaceAll(PLACEHOLDER_PATTERN, (_full, key: string) => {
    if (!(key in environment)) {
      missing.add(key);
    }
    return "";
  });

  return [...missing].sort();
}

function renderTemplate(template: string, environment: Record<string, string>): string {
  return template.replaceAll(PLACEHOLDER_PATTERN, (_full, key: string) => {
    return environment[key] ?? "";
  });
}

export function resolveHttpRequest(
  request: ParsedHttpRequest,
  environment: Record<string, string>,
): ResolvedHttpRequest {
  const missing = new Set<string>();

  for (const missingKey of collectMissingPlaceholders(request.url, environment)) {
    missing.add(missingKey);
  }

  for (const headerValue of Object.values(request.headers)) {
    for (const missingKey of collectMissingPlaceholders(headerValue, environment)) {
      missing.add(missingKey);
    }
  }

  if (request.body) {
    for (const missingKey of collectMissingPlaceholders(request.body, environment)) {
      missing.add(missingKey);
    }
  }

  const missingVariables = [...missing].sort();
  if (missingVariables.length > 0) {
    throw new MissingEnvVariablesError(missingVariables);
  }

  const resolved = {
    ...request,
    url: renderTemplate(request.url, environment),
    headers: Object.fromEntries(
      Object.entries(request.headers).map(([key, value]) => [
        key,
        renderTemplate(value, environment),
      ]),
    ),
    body: request.body ? renderTemplate(request.body, environment) : undefined,
    missingVariables: [],
  };

  return ResolvedHttpRequestSchema.parse(resolved);
}
