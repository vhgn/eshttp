import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { getBackendConfig, resetBackendConfigForTests } from "../api/_lib/config";

const REQUIRED_ENV: Record<string, string> = {
  DATABASE_URL: "postgresql://user:password@db.example.com/neondb?sslmode=require",
  GITHUB_CLIENT_ID: "client-id",
  GITHUB_CLIENT_SECRET: "client-secret",
  SESSION_ENCRYPTION_KEY: "session-encryption-key",
};

const APP_ORIGIN_ENV_KEYS = [
  "APP_ORIGIN",
  "GITHUB_REDIRECT_URI",
  "VERCEL_ENV",
  "VERCEL_URL",
  "VERCEL_BRANCH_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
] as const;

function resetAppOriginEnv(): void {
  for (const key of APP_ORIGIN_ENV_KEYS) {
    delete process.env[key];
  }
}

describe("api config app origin", () => {
  beforeEach(() => {
    resetBackendConfigForTests();
    resetAppOriginEnv();
    Object.assign(process.env, REQUIRED_ENV);
  });

  afterEach(() => {
    resetBackendConfigForTests();
    resetAppOriginEnv();
    for (const key of Object.keys(REQUIRED_ENV)) {
      delete process.env[key];
    }
  });

  test("uses explicit APP_ORIGIN when provided", () => {
    process.env.APP_ORIGIN = "https://manual.example.com/root";
    process.env.VERCEL_URL = "deployment.vercel.app";

    const config = getBackendConfig();

    expect(config.appOrigin).toBe("https://manual.example.com");
  });

  test("infers APP_ORIGIN from VERCEL_URL when APP_ORIGIN is missing", () => {
    process.env.VERCEL_URL = "desktop-preview-123.vercel.app";

    const config = getBackendConfig();

    expect(config.appOrigin).toBe("https://desktop-preview-123.vercel.app");
  });

  test("prefers VERCEL_PROJECT_PRODUCTION_URL in production deployments", () => {
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "desktop.example.com";
    process.env.VERCEL_URL = "desktop-prod.vercel.app";

    const config = getBackendConfig();

    expect(config.appOrigin).toBe("https://desktop.example.com");
  });

  test("throws when neither APP_ORIGIN nor Vercel origin env is available", () => {
    expect(() => getBackendConfig()).toThrow(
      "Missing required environment variable: APP_ORIGIN (or VERCEL_URL/VERCEL_BRANCH_URL)",
    );
  });

  test("infers GITHUB_REDIRECT_URI from app origin when unset", () => {
    process.env.APP_ORIGIN = "https://manual.example.com";

    const config = getBackendConfig();

    expect(config.githubRedirectUri).toBe("https://manual.example.com/api/auth/github/callback");
  });

  test("uses explicit GITHUB_REDIRECT_URI when provided", () => {
    process.env.APP_ORIGIN = "https://manual.example.com";
    process.env.GITHUB_REDIRECT_URI = "https://manual.example.com/custom/callback";

    const config = getBackendConfig();

    expect(config.githubRedirectUri).toBe("https://manual.example.com/custom/callback");
  });
});
