import type { GitHubAuthIntent } from "./config";
import { getBackendConfig } from "./config";
import { consumeOAuthState, getSqlClient, saveOAuthState } from "./db";
import { normalizeReturnTo } from "./http";
import { pkceCodeChallenge, randomToken, sha256Base64Url } from "./security";

function scopesForIntent(intent: GitHubAuthIntent): string[] {
  if (intent === "write") {
    return ["read:user", "repo"];
  }

  return ["read:user"];
}

export function authorizePath(intent: GitHubAuthIntent, returnTo: string): string {
  const query = new URLSearchParams({
    intent,
    returnTo,
  });
  return `/api/auth/github/start?${query.toString()}`;
}

export async function createAuthorizationUrl(input: {
  intent: GitHubAuthIntent;
  returnTo: unknown;
}): Promise<{ url: string }> {
  const config = getBackendConfig();
  const db = await getSqlClient(config.databaseUrl);

  const state = randomToken(32);
  const codeVerifier = randomToken(64);
  const codeChallenge = pkceCodeChallenge(codeVerifier);

  await saveOAuthState(db, {
    stateHash: sha256Base64Url(state),
    codeVerifier,
    intent: input.intent,
    returnTo: normalizeReturnTo(input.returnTo, config.appOrigin),
    ttlSeconds: config.oauthStateTtlSeconds,
  });

  const scopes = scopesForIntent(input.intent).join(" ");
  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", config.githubClientId);
  authorizeUrl.searchParams.set("redirect_uri", config.githubRedirectUri);
  authorizeUrl.searchParams.set("scope", scopes);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", codeChallenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  if (input.intent === "write") {
    authorizeUrl.searchParams.set("prompt", "consent");
  }

  return {
    url: authorizeUrl.toString(),
  };
}

export async function consumeOAuthStateByRawState(state: string): Promise<{
  codeVerifier: string;
  intent: GitHubAuthIntent;
  returnTo: string;
} | null> {
  const config = getBackendConfig();
  const db = await getSqlClient(config.databaseUrl);

  const consumed = await consumeOAuthState(db, sha256Base64Url(state));
  if (!consumed) {
    return null;
  }

  return {
    codeVerifier: consumed.code_verifier,
    intent: consumed.intent,
    returnTo: consumed.return_to,
  };
}
