import { describe, expect, test } from "bun:test";
import { Readable } from "node:stream";
import type { VercelRequest } from "@vercel/node";
import {
  computeGitHubWebhookSignature,
  readWebhookPayload,
  verifyGitHubWebhookSignature,
} from "../api/_lib/webhook";

describe("api webhook helpers", () => {
  test("verifies a valid webhook signature", () => {
    const payload = Buffer.from('{"action":"ping"}', "utf8");
    const signature = computeGitHubWebhookSignature(payload, "secret");

    expect(verifyGitHubWebhookSignature(payload, "secret", signature)).toBe(true);
  });

  test("rejects invalid signature values", () => {
    const payload = Buffer.from('{"action":"ping"}', "utf8");
    const signature = computeGitHubWebhookSignature(payload, "secret");

    expect(verifyGitHubWebhookSignature(payload, "wrong-secret", signature)).toBe(false);
    expect(
      verifyGitHubWebhookSignature(payload, "secret", signature.replace("sha256=", "sha1=")),
    ).toBe(false);
  });

  test("reads payload from req.body object", async () => {
    const req = {
      body: { action: "ping" },
      headers: {},
    } as unknown as VercelRequest;

    const payload = await readWebhookPayload(req);

    expect(payload.toString("utf8")).toBe('{"action":"ping"}');
  });

  test("reads payload from request stream when req.body is empty", async () => {
    const stream = Readable.from(['{"action":"ping"}']) as unknown as VercelRequest;
    (stream as { body?: unknown }).body = undefined;
    (stream as { headers?: Record<string, string> }).headers = {};

    const payload = await readWebhookPayload(stream);

    expect(payload.toString("utf8")).toBe('{"action":"ping"}');
  });
});
