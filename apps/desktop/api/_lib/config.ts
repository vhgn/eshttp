export type GitHubAuthIntent = "read" | "write";

export interface BackendConfig {
  appOrigin: string;
  databaseUrl: string;
  githubClientId: string;
  githubClientSecret: string;
  githubRedirectUri: string;
  githubWebhookSecret: string | null;
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
const URL_PROTOCOL_PATTERN = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;

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
  const normalizedValue = URL_PROTOCOL_PATTERN.test(value) ? value : `https://${value}`;
  const parsed = new URL(normalizedValue);
  return parsed.origin;
}

function requiredAppOrigin(): string {
  const explicitAppOrigin = process.env.APP_ORIGIN?.trim();
  if (explicitAppOrigin) {
    return normalizeOrigin(explicitAppOrigin);
  }

  const vercelEnv = process.env.VERCEL_ENV?.trim();
  const vercelOriginCandidates =
    vercelEnv === "production"
      ? [
          process.env.VERCEL_PROJECT_PRODUCTION_URL,
          process.env.VERCEL_BRANCH_URL,
          process.env.VERCEL_URL,
        ]
      : [
          process.env.VERCEL_BRANCH_URL,
          process.env.VERCEL_URL,
          process.env.VERCEL_PROJECT_PRODUCTION_URL,
        ];

  for (const candidate of vercelOriginCandidates) {
    const value = candidate?.trim();
    if (value) {
      return normalizeOrigin(value);
    }
  }

  throw new Error(
    "Missing required environment variable: APP_ORIGIN (or VERCEL_URL/VERCEL_BRANCH_URL)",
  );
}

function requiredGithubRedirectUri(appOrigin: string): string {
  const explicitRedirectUri = process.env.GITHUB_REDIRECT_URI?.trim();
  if (explicitRedirectUri) {
    return new URL(explicitRedirectUri).toString();
  }

  return `${appOrigin}/api/auth/github/callback`;
}

export function getBackendConfig(): BackendConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const appOrigin = requiredAppOrigin();

  cachedConfig = {
    appOrigin,
    databaseUrl: required("DATABASE_URL"),
    githubClientId: required("GITHUB_CLIENT_ID"),
    githubClientSecret: required("GITHUB_CLIENT_SECRET"),
    githubRedirectUri: requiredGithubRedirectUri(appOrigin),
<<<<<<< ours
    githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET?.trim() || null,
=======
>>>>>>> theirs
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
