import type { VercelRequest, VercelResponse } from "@vercel/node";
import { methodNotAllowed, sendJson } from "../../_lib/http";
import { hasWriteScope, readSession } from "../../_lib/session";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (methodNotAllowed(req, res, ["GET"])) {
    return;
  }

  const session = await readSession(req);
  if (!session) {
    sendJson(res, 200, {
      authenticated: false,
    });
    return;
  }

  sendJson(res, 200, {
    authenticated: true,
    login: session.githubLogin,
    scopes: session.scopes,
    canWrite: hasWriteScope(session.scopes),
  });
}
