import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBackendConfig } from "./config";
import {
  getGithubSession,
  getSqlClient,
  parseScopes,
  saveGithubSession,
  touchGithubSession,
} from "./db";
import { clearCookie, parseCookies, setCookie } from "./http";
import { decryptSecret, encryptSecret, randomToken, sha256Base64Url } from "./security";

export interface AuthenticatedGitHubSession {
  githubUserId: string;
  githubLogin: string;
  scopes: string[];
  accessToken: string;
}

export function hasWriteScope(scopes: string[]): boolean {
  const normalized = new Set(scopes);
  return normalized.has("repo") || normalized.has("public_repo");
}

export async function createSession(
  res: VercelResponse,
  input: {
    githubUserId: string;
    githubLogin: string;
    accessToken: string;
    scopes: string[];
  },
): Promise<void> {
  const config = getBackendConfig();
  const db = await getSqlClient(config.databaseUrl);

  const sessionToken = randomToken(32);
  const sessionHash = sha256Base64Url(sessionToken);
  const cipher = encryptSecret(input.accessToken, config.sessionEncryptionKey);

  await saveGithubSession(db, {
    sessionHash,
    githubUserId: input.githubUserId,
    githubLogin: input.githubLogin,
    accessTokenCipher: cipher,
    scopes: input.scopes,
  });

  setCookie(res, config.sessionCookieName, sessionToken, {
    maxAgeSeconds: config.sessionTtlSeconds,
    secure: true,
  });
}

export async function readSession(req: VercelRequest): Promise<AuthenticatedGitHubSession | null> {
  const config = getBackendConfig();
  const cookie = parseCookies(req).get(config.sessionCookieName);
  if (!cookie) {
    return null;
  }

  const sessionHash = sha256Base64Url(cookie);
  const db = await getSqlClient(config.databaseUrl);
  const row = await getGithubSession(db, sessionHash);
  if (!row) {
    return null;
  }

  let accessToken: string;
  try {
    accessToken = decryptSecret(row.access_token_cipher, config.sessionEncryptionKey);
  } catch {
    return null;
  }

  await touchGithubSession(db, sessionHash);

  return {
    githubUserId: row.github_user_id,
    githubLogin: row.github_login,
    scopes: parseScopes(row.scopes_text),
    accessToken,
  };
}

export function clearSession(res: VercelResponse): void {
  const config = getBackendConfig();
  clearCookie(res, config.sessionCookieName, true);
}
