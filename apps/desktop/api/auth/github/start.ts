import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { GitHubAuthIntent } from "../../_lib/config";
import { getBackendConfig } from "../../_lib/config";
import { methodNotAllowed, normalizeReturnTo, queryString, sendError } from "../../_lib/http";
import { createAuthorizationUrl } from "../../_lib/oauth";

function parseIntent(value: string | null): GitHubAuthIntent {
  return value === "write" ? "write" : "read";
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (methodNotAllowed(req, res, ["GET"])) {
    return;
  }

  try {
    const config = getBackendConfig();
    const intent = parseIntent(queryString(req, "intent"));
    const normalizedReturnTo = normalizeReturnTo(queryString(req, "returnTo"), config.appOrigin);

    const authorize = await createAuthorizationUrl({
      intent,
      returnTo: normalizedReturnTo,
    });

    res.status(302).setHeader("cache-control", "no-store");
    res.setHeader("location", authorize.url);
    res.end();
  } catch (error) {
    sendError(res, 500, error instanceof Error ? error.message : "Failed to start OAuth flow");
  }
}
