import type { VercelRequest, VercelResponse } from "@vercel/node";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function getHeader(req: VercelRequest, name: string): string | null {
  const value = req.headers[name.toLowerCase()];
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return null;
}

export function parseCookies(req: VercelRequest): Map<string, string> {
  const cookieHeader = getHeader(req, "cookie");
  const map = new Map<string, string>();
  if (!cookieHeader) {
    return map;
  }

  for (const entry of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = entry.split("=");
    const name = rawName?.trim();
    if (!name) {
      continue;
    }

    map.set(name, decodeURIComponent(rawValue.join("=").trim()));
  }

  return map;
}

export function setCookie(
  res: VercelResponse,
  name: string,
  value: string,
  options: {
    maxAgeSeconds: number;
    secure: boolean;
  },
): void {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${options.maxAgeSeconds}`,
  ];

  if (options.secure) {
    parts.push("Secure");
  }

  res.setHeader("Set-Cookie", parts.join("; "));
}

export function clearCookie(res: VercelResponse, name: string, secure: boolean): void {
  const parts = [`${name}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];

  if (secure) {
    parts.push("Secure");
  }

  res.setHeader("Set-Cookie", parts.join("; "));
}

export function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).setHeader("content-type", JSON_HEADERS["content-type"]);
  res.setHeader("cache-control", JSON_HEADERS["cache-control"]);
  res.send(JSON.stringify(body));
}

export function sendError(res: VercelResponse, status: number, message: string): void {
  sendJson(res, status, { error: message });
}

export function methodNotAllowed(
  req: VercelRequest,
  res: VercelResponse,
  allowedMethods: string[],
): boolean {
  if (allowedMethods.includes(req.method ?? "")) {
    return false;
  }

  res.setHeader("Allow", allowedMethods.join(", "));
  sendError(res, 405, "Method not allowed");
  return true;
}

export function requireSameOrigin(req: VercelRequest, expectedOrigin: string): boolean {
  const origin = getHeader(req, "origin");
  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).origin === expectedOrigin;
  } catch {
    return false;
  }
}

export function normalizeReturnTo(returnTo: unknown, appOrigin: string): string {
  const value = Array.isArray(returnTo) ? returnTo[0] : returnTo;
  if (typeof value !== "string" || value.trim().length === 0) {
    return "/";
  }

  const trimmed = value.trim();
  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.origin !== appOrigin) {
      return "/";
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

export function queryString(req: VercelRequest, key: string): string | null {
  const value = req.query[key];
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return null;
}

export function parseJsonBody(req: VercelRequest): unknown {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }

  if (Buffer.isBuffer(req.body)) {
    try {
      return JSON.parse(req.body.toString("utf8"));
    } catch {
      return null;
    }
  }

  if (typeof req.body === "object" && req.body != null) {
    return req.body;
  }

  return null;
}

export function requestOrigin(req: VercelRequest, fallbackOrigin: string): string {
  const forwardedProto = getHeader(req, "x-forwarded-proto") || "https";
  const forwardedHost = getHeader(req, "x-forwarded-host") || getHeader(req, "host");
  if (!forwardedHost) {
    return fallbackOrigin;
  }

  return `${forwardedProto}://${forwardedHost}`;
}
