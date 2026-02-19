import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBackendConfig } from "../_lib/config";
import { extractWorkspacesFromRepos } from "../_lib/github";
import { methodNotAllowed, sendError, sendJson } from "../_lib/http";
import { readSession } from "../_lib/session";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (methodNotAllowed(req, res, ["GET"])) {
    return;
  }

  try {
    const session = await readSession(req);
    if (!session) {
      sendError(res, 401, "Not authenticated with GitHub");
      return;
    }

    const config = getBackendConfig();
    const snapshots = await extractWorkspacesFromRepos(
      session.accessToken,
      config.githubRepoScanLimit,
    );

    sendJson(res, 200, {
      workspaces: snapshots,
    });
  } catch (error) {
    sendError(res, 500, error instanceof Error ? error.message : "Failed to list workspaces");
  }
}
