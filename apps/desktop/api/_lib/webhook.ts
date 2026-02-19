import { createHmac } from "node:crypto";
import type { VercelRequest } from "@vercel/node";
import { safeStringEqual } from "./security";

const GITHUB_SIGNATURE_PREFIX = "sha256=";

export function readHeader(req: VercelRequest, name: string): string | null {
  const value = req.headers[name.toLowerCase()];
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return null;
}

function payloadFromBody(body: unknown): Buffer | null {
  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (typeof body === "string") {
    return Buffer.from(body, "utf8");
  }

  if (body != null && typeof body === "object") {
    return Buffer.from(JSON.stringify(body), "utf8");
  }

  return null;
}

export async function readWebhookPayload(req: VercelRequest): Promise<Buffer> {
  const fromBody = payloadFromBody(req.body);
  if (fromBody) {
    return fromBody;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

export function computeGitHubWebhookSignature(payload: Buffer, secret: string): string {
  const digest = createHmac("sha256", secret).update(payload).digest("hex");
  return `${GITHUB_SIGNATURE_PREFIX}${digest}`;
}

export function verifyGitHubWebhookSignature(
  payload: Buffer,
  secret: string,
  signatureHeader: string,
): boolean {
  if (!signatureHeader.startsWith(GITHUB_SIGNATURE_PREFIX)) {
    return false;
  }

  const expectedSignature = computeGitHubWebhookSignature(payload, secret);
  return safeStringEqual(expectedSignature, signatureHeader);
}
