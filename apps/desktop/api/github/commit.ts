import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBackendConfig } from "../_lib/config";
import { commitWorkspaceFiles } from "../_lib/github";
import {
  methodNotAllowed,
  normalizeReturnTo,
  parseJsonBody,
  queryString,
  requestOrigin,
  requireSameOrigin,
  sendError,
  sendJson,
} from "../_lib/http";
import { authorizePath } from "../_lib/oauth";
import { hasWriteScope, readSession } from "../_lib/session";
import { validateCommitPayload } from "../_lib/validation";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (methodNotAllowed(req, res, ["POST"])) {
    return;
  }

  try {
    const config = getBackendConfig();

    if (!requireSameOrigin(req, config.appOrigin)) {
      sendError(res, 403, "Cross-origin commit requests are not allowed");
      return;
    }

    const session = await readSession(req);
    if (!session) {
      sendError(res, 401, "Not authenticated with GitHub");
      return;
    }

    if (!hasWriteScope(session.scopes)) {
      const fallbackReturnTo = normalizeReturnTo(queryString(req, "returnTo"), config.appOrigin);
      const refererBasedReturnTo = normalizeReturnTo(req.headers.referer, config.appOrigin);
      const returnTo = refererBasedReturnTo === "/" ? fallbackReturnTo : refererBasedReturnTo;
      const origin = requestOrigin(req, config.appOrigin);

      sendJson(res, 403, {
        error: "WRITE_SCOPE_REQUIRED",
        reauthUrl: `${origin}${authorizePath("write", returnTo)}`,
      });
      return;
    }

    const payload = validateCommitPayload(parseJsonBody(req));
    if (!payload) {
      sendError(res, 400, "Invalid commit payload");
      return;
    }

    const commit = await commitWorkspaceFiles(session.accessToken, payload);
    sendJson(res, 200, {
      committedFiles: Object.keys(payload.files).length,
      commitSha: commit.commitSha,
    });
  } catch (error) {
    sendError(res, 500, error instanceof Error ? error.message : "Commit failed");
  }
}
