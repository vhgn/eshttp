import { describe, expect, test } from "bun:test";
import { newDb } from "pg-mem";
import {
  consumeOAuthState,
  ensureSchema,
  getGithubSession,
  parseScopes,
  type SqlClient,
  saveGithubSession,
  saveOAuthState,
} from "../api/_lib/db";

async function createPgNewClient(): Promise<{ client: SqlClient; close: () => Promise<void> }> {
  const db = newDb();
  const pg = db.adapters.createPg();
  const client = new pg.Client();
  await client.connect();

  return {
    client: {
      query: async <T>(text: string, params: unknown[] = []) => {
        const result = await client.query(text, params);
        return { rows: (result.rows as T[]) ?? [] };
      },
    },
    close: () => client.end(),
  };
}

describe("api db layer", () => {
  test("oauth state can be consumed exactly once", async () => {
    const { client, close } = await createPgNewClient();
    await ensureSchema(client);

    await saveOAuthState(client, {
      stateHash: "state-hash",
      codeVerifier: "verifier",
      intent: "read",
      returnTo: "/",
      ttlSeconds: 300,
    });

    const first = await consumeOAuthState(client, "state-hash");
    const second = await consumeOAuthState(client, "state-hash");

    expect(first?.code_verifier).toBe("verifier");
    expect(first?.intent).toBe("read");
    expect(second).toBeNull();

    await close();
  });

  test("github sessions persist encrypted token payload and scopes", async () => {
    const { client, close } = await createPgNewClient();
    await ensureSchema(client);

    await saveGithubSession(client, {
      sessionHash: "session-hash",
      githubUserId: "123",
      githubLogin: "octocat",
      accessTokenCipher: "ciphertext",
      scopes: ["read:user", "repo", "repo"],
    });

    const stored = await getGithubSession(client, "session-hash");
    expect(stored?.github_login).toBe("octocat");
    expect(stored?.access_token_cipher).toBe("ciphertext");
    expect(parseScopes(stored?.scopes_text ?? "")).toEqual(["read:user", "repo"]);

    await close();
  });
});
