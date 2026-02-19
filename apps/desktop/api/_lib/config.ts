export type GitHubAuthIntent = "read" | "write";

export interface BackendConfig {
  appOrigin: string;
  databaseUrl: string;
  githubClientId: string;
  githubClientSecret: string;
  githubRedirectUri: string;
  sessionCookieName: string;
  sessionTtlSeconds: number;
  oauthStateTtlSeconds: number;
  sessionEncryptionKey: string;
  githubRepoScanLimit: number;
}

const DEFAULT_SESSION_COOKIE_NAME = "eshttp_github_session";
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const DEFAULT_STATE_TTL_SECONDS = 60 * 10;
const DEFAULT_REPO_SCAN_LIMIT = 20;

let cachedConfig: BackendConfig | null = null;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function normalizeOrigin(value: string): string {
  const parsed = new URL(value);
  return parsed.origin;
}

export function getBackendConfig(): BackendConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  cachedConfig = {
    appOrigin: normalizeOrigin(required("APP_ORIGIN")),
    databaseUrl: required("DATABASE_URL"),
    githubClientId: required("GITHUB_CLIENT_ID"),
    githubClientSecret: required("GITHUB_CLIENT_SECRET"),
    githubRedirectUri: required("GITHUB_REDIRECT_URI"),
    sessionCookieName: process.env.SESSION_COOKIE_NAME?.trim() || DEFAULT_SESSION_COOKIE_NAME,
    sessionTtlSeconds: optionalInt("SESSION_TTL_SECONDS", DEFAULT_SESSION_TTL_SECONDS),
    oauthStateTtlSeconds: optionalInt("OAUTH_STATE_TTL_SECONDS", DEFAULT_STATE_TTL_SECONDS),
    sessionEncryptionKey: required("SESSION_ENCRYPTION_KEY"),
    githubRepoScanLimit: optionalInt("GITHUB_REPO_SCAN_LIMIT", DEFAULT_REPO_SCAN_LIMIT),
  };

  return cachedConfig;
}

export function resetBackendConfigForTests(): void {
  cachedConfig = null;
}
