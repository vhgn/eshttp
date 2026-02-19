import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const AAD = "eshttp-github-session";

function toBase64Url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(`${normalized}${"=".repeat(padLength)}`, "base64");
}

export function randomToken(bytes = 32): string {
  return toBase64Url(randomBytes(bytes));
}

export function sha256Base64Url(value: string): string {
  return toBase64Url(createHash("sha256").update(value).digest());
}

export function pkceCodeChallenge(codeVerifier: string): string {
  return sha256Base64Url(codeVerifier);
}

function parseEncryptionKey(base64UrlKey: string): Buffer {
  const key = fromBase64Url(base64UrlKey);
  if (key.byteLength !== 32) {
    throw new Error("SESSION_ENCRYPTION_KEY must be a base64url-encoded 32-byte key");
  }

  return key;
}

export function encryptSecret(value: string, base64UrlKey: string): string {
  const key = parseEncryptionKey(base64UrlKey);
  const iv = randomBytes(12);

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(AAD, "utf8"));

  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${toBase64Url(iv)}.${toBase64Url(authTag)}.${toBase64Url(encrypted)}`;
}

export function decryptSecret(payload: string, base64UrlKey: string): string {
  const parts = payload.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new Error("Invalid encrypted payload format");
  }

  const [ivEncoded, tagEncoded, encryptedEncoded] = parts as [string, string, string];
  const iv = fromBase64Url(ivEncoded);
  const authTag = fromBase64Url(tagEncoded);
  const encrypted = fromBase64Url(encryptedEncoded);

  const key = parseEncryptionKey(base64UrlKey);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(Buffer.from(AAD, "utf8"));
  decipher.setAuthTag(authTag);

  const output = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return output.toString("utf8");
}

export function safeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.byteLength !== rightBuffer.byteLength) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function normalizeRelativePath(value: string): string | null {
  const normalized = value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!normalized) {
    return ".";
  }

  const segments = normalized.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return null;
  }

  return segments.join("/");
}

export function joinRepoPath(root: string, child: string): string | null {
  const normalizedRoot = normalizeRelativePath(root);
  const normalizedChild = normalizeRelativePath(child);
  if (!normalizedRoot || !normalizedChild) {
    return null;
  }

  if (normalizedRoot === ".") {
    return normalizedChild;
  }

  if (normalizedChild === ".") {
    return normalizedRoot;
  }

  return `${normalizedRoot}/${normalizedChild}`;
}
