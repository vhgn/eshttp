import { Pool } from "@neondatabase/serverless";

export type GitHubAuthIntent = "read" | "write";

export interface SqlClient {
  query<T>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export interface OAuthStateRecord {
  state_hash: string;
  code_verifier: string;
  intent: GitHubAuthIntent;
  return_to: string;
}

export interface GithubSessionRecord {
  session_hash: string;
  github_user_id: string;
  github_login: string;
  access_token_cipher: string;
  scopes_text: string;
}

interface SaveOAuthStateInput {
  stateHash: string;
  codeVerifier: string;
  intent: GitHubAuthIntent;
  returnTo: string;
  ttlSeconds: number;
}

interface SaveGithubSessionInput {
  sessionHash: string;
  githubUserId: string;
  githubLogin: string;
  accessTokenCipher: string;
  scopes: string[];
}

let cachedClient: SqlClient | null = null;
let schemaReady = false;

function normalizeScopes(scopes: string[]): string {
  return Array.from(new Set(scopes.map((entry) => entry.trim()).filter(Boolean)))
    .sort()
    .join(" ");
}

export function parseScopes(scopesText: string): string[] {
  return scopesText
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function createNeonSqlClient(databaseUrl: string): SqlClient {
  const pool = new Pool({ connectionString: databaseUrl });
  return {
    async query<T>(text: string, params: unknown[] = []) {
      const result = await pool.query(text, params);
      return { rows: (result.rows as T[]) ?? [] };
    },
  };
}

export function setSqlClientForTests(client: SqlClient | null): void {
  cachedClient = client;
  schemaReady = false;
}

export async function getSqlClient(databaseUrl: string): Promise<SqlClient> {
  if (!cachedClient) {
    cachedClient = createNeonSqlClient(databaseUrl);
  }

  if (!schemaReady) {
    await ensureSchema(cachedClient);
    schemaReady = true;
  }

  return cachedClient;
}

export async function ensureSchema(client: SqlClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS oauth_states (
      state_hash TEXT PRIMARY KEY,
      code_verifier TEXT NOT NULL,
      intent TEXT NOT NULL,
      return_to TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS github_sessions (
      session_hash TEXT PRIMARY KEY,
      github_user_id TEXT NOT NULL,
      github_login TEXT NOT NULL,
      access_token_cipher TEXT NOT NULL,
      scopes_text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function saveOAuthState(client: SqlClient, input: SaveOAuthStateInput): Promise<void> {
  await client.query(
    `
      INSERT INTO oauth_states (state_hash, code_verifier, intent, return_to, expires_at)
      VALUES ($1, $2, $3, $4, NOW() + ($5::text || ' seconds')::interval)
      ON CONFLICT (state_hash) DO UPDATE
      SET code_verifier = EXCLUDED.code_verifier,
          intent = EXCLUDED.intent,
          return_to = EXCLUDED.return_to,
          expires_at = EXCLUDED.expires_at,
          used_at = NULL;
    `,
    [input.stateHash, input.codeVerifier, input.intent, input.returnTo, input.ttlSeconds],
  );

  await client.query(
    `
      DELETE FROM oauth_states
      WHERE expires_at < NOW()
         OR (used_at IS NOT NULL AND used_at < NOW() - interval '1 day');
    `,
  );
}

export async function consumeOAuthState(
  client: SqlClient,
  stateHash: string,
): Promise<OAuthStateRecord | null> {
  const result = await client.query<OAuthStateRecord>(
    `
      UPDATE oauth_states
      SET used_at = NOW()
      WHERE state_hash = $1
        AND used_at IS NULL
        AND expires_at > NOW()
      RETURNING state_hash, code_verifier, intent, return_to;
    `,
    [stateHash],
  );

  return result.rows[0] ?? null;
}

export async function saveGithubSession(
  client: SqlClient,
  input: SaveGithubSessionInput,
): Promise<void> {
  await client.query(
    `
      INSERT INTO github_sessions (
        session_hash,
        github_user_id,
        github_login,
        access_token_cipher,
        scopes_text
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (session_hash) DO UPDATE
      SET github_user_id = EXCLUDED.github_user_id,
          github_login = EXCLUDED.github_login,
          access_token_cipher = EXCLUDED.access_token_cipher,
          scopes_text = EXCLUDED.scopes_text,
          updated_at = NOW(),
          last_used_at = NOW();
    `,
    [
      input.sessionHash,
      input.githubUserId,
      input.githubLogin,
      input.accessTokenCipher,
      normalizeScopes(input.scopes),
    ],
  );
}

export async function getGithubSession(
  client: SqlClient,
  sessionHash: string,
): Promise<GithubSessionRecord | null> {
  const result = await client.query<GithubSessionRecord>(
    `
      SELECT session_hash, github_user_id, github_login, access_token_cipher, scopes_text
      FROM github_sessions
      WHERE session_hash = $1
      LIMIT 1;
    `,
    [sessionHash],
  );

  return result.rows[0] ?? null;
}

export async function touchGithubSession(client: SqlClient, sessionHash: string): Promise<void> {
  await client.query(
    `
      UPDATE github_sessions
      SET last_used_at = NOW(), updated_at = NOW()
      WHERE session_hash = $1;
    `,
    [sessionHash],
  );
}
