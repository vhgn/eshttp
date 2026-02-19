import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBackendConfig } from "../../_lib/config";
import { exchangeGitHubCodeForToken, fetchGitHubUser } from "../../_lib/github";
import { methodNotAllowed, queryString, sendError } from "../../_lib/http";
import { consumeOAuthStateByRawState } from "../../_lib/oauth";
import { createSession } from "../../_lib/session";

function appendAuthResult(returnTo: string, intent: "read" | "write"): string {
  const base = returnTo.startsWith("/")
    ? `https://local.invalid${returnTo}`
    : `https://local.invalid/`;
  const next = new URL(base);
  next.searchParams.set(intent === "write" ? "github_write" : "github_read", "1");
  return `${next.pathname}${next.search}${next.hash}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (methodNotAllowed(req, res, ["GET"])) {
    return;
  }

  try {
    const code = queryString(req, "code");
    const state = queryString(req, "state");
    if (!code || !state) {
      sendError(res, 400, "Missing OAuth code or state");
      return;
    }

    const oauthState = await consumeOAuthStateByRawState(state);
    if (!oauthState) {
      sendError(res, 400, "Invalid or expired OAuth state");
      return;
    }

    const config = getBackendConfig();
    const token = await exchangeGitHubCodeForToken({
      clientId: config.githubClientId,
      clientSecret: config.githubClientSecret,
      redirectUri: config.githubRedirectUri,
      code,
      codeVerifier: oauthState.codeVerifier,
    });

    const user = await fetchGitHubUser(token.accessToken);

    await createSession(res, {
      githubUserId: user.id,
      githubLogin: user.login,
      accessToken: token.accessToken,
      scopes: token.scopes,
    });

    const destination = appendAuthResult(oauthState.returnTo, oauthState.intent);
    res.status(302).setHeader("cache-control", "no-store");
    res.setHeader("location", destination);
    res.end();
  } catch (error) {
    sendError(res, 500, error instanceof Error ? error.message : "OAuth callback failed");
  }
}
