import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBackendConfig } from "../_lib/config";
import { methodNotAllowed, sendError, sendJson } from "../_lib/http";
import { readHeader, readWebhookPayload, verifyGitHubWebhookSignature } from "../_lib/webhook";

function parseWebhookPayload(payload: Buffer): unknown {
  const bodyText = payload.toString("utf8");
  if (!bodyText) {
    return null;
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (methodNotAllowed(req, res, ["POST"])) {
    return;
  }

  try {
    const config = getBackendConfig();
    if (!config.githubWebhookSecret) {
      sendError(res, 500, "Missing GITHUB_WEBHOOK_SECRET");
      return;
    }

    const signature = readHeader(req, "x-hub-signature-256");
    if (!signature) {
      sendError(res, 401, "Missing X-Hub-Signature-256 header");
      return;
    }

    const event = readHeader(req, "x-github-event");
    if (!event) {
      sendError(res, 400, "Missing X-GitHub-Event header");
      return;
    }

    const delivery = readHeader(req, "x-github-delivery");
    const payload = await readWebhookPayload(req);
    if (!verifyGitHubWebhookSignature(payload, config.githubWebhookSecret, signature)) {
      sendError(res, 401, "Invalid webhook signature");
      return;
    }

    const parsedPayload = parseWebhookPayload(payload);
    if (!parsedPayload) {
      sendError(res, 400, "Invalid webhook payload");
      return;
    }

    if (event === "ping") {
      sendJson(res, 200, {
        ok: true,
        event,
        delivery,
      });
      return;
    }

    sendJson(res, 202, {
      ok: true,
      event,
      delivery,
    });
  } catch (error) {
    sendError(res, 500, error instanceof Error ? error.message : "Webhook handling failed");
  }
}
