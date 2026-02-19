# Desktop Vercel GitHub Backend

Scope:
- `apps/desktop/vercel.json`
- `apps/desktop/.env.example`
- `apps/desktop/tsconfig.api.json`
- `apps/desktop/api/**`
- `apps/desktop/api-build/**`
- `apps/desktop/src/data/storageOptions.ts`
- `apps/desktop/src/data/collectionsRepository.ts`

## Deployment surface

`apps/desktop/vercel.json` configures:
- Vite static build output (`dist`)
- Node.js Vercel Functions for `api-build/**/*.js` (duration only; runtime version is read from `apps/desktop/package.json` `engines.node`)
- Build-time transpilation of backend TS (`apps/desktop/api/**/*.ts`) into CommonJS JS (`apps/desktop/api-build/**/*.js`) via `tsconfig.api.json`
- Explicit routed API endpoints:
  - `/api/auth/github/start`
  - `/api/auth/github/callback`
  - `/api/auth/github/session`
  - `/api/github/workspaces`
  - `/api/github/commit`
  - `/api/github/webhook`

## Environment contract

Required vars in `apps/desktop/.env.example`:
- `DATABASE_URL` (Neon)
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `SESSION_ENCRYPTION_KEY` (base64url 32-byte key)

Optional:
- `APP_ORIGIN` (inferred from `VERCEL_PROJECT_PRODUCTION_URL`/`VERCEL_BRANCH_URL`/`VERCEL_URL` when omitted)
- `GITHUB_REDIRECT_URI` (defaults to `${APP_ORIGIN}/api/auth/github/callback`)
<<<<<<< ours
- `GITHUB_WEBHOOK_SECRET` (required only for `/api/github/webhook` GitHub App webhook signature verification)
=======
>>>>>>> theirs
- `SESSION_COOKIE_NAME`
- `SESSION_TTL_SECONDS`
- `OAUTH_STATE_TTL_SECONDS`
- `GITHUB_REPO_SCAN_LIMIT`

## OAuth/session flow

Start endpoint (`/api/auth/github/start`):
- Generates PKCE verifier/challenge + random state
- Persists hashed state in Neon with TTL
- Normalizes `returnTo` to same-origin only
- Redirects to GitHub authorize URL

Callback endpoint (`/api/auth/github/callback`):
- Atomically consumes state (single-use)
- Exchanges code for token with PKCE verifier
- Fetches GitHub user
- Encrypts access token before DB persist
- Stores hashed session id and sets HttpOnly/SameSite cookie

Session endpoint (`/api/auth/github/session`):
- Reads cookie + Neon session
- Returns auth status and write-capability hint

## Workspace discovery

`GET /api/github/workspaces`:
- Requires valid session
- Lists accessible repos (`/user/repos`, bounded by `GITHUB_REPO_SCAN_LIMIT`)
- Scans repo git trees for `.eshttp/workspaces/<workspace>/...*.http`
- Hydrates collection/request snapshots (and optional `icon.svg`)

Desktop import path:
- `CollectionsRepository.importGitHubWorkspaces()` stores snapshots in IndexedDB cache
- Imports are marked `storageKind: "github"` + repo metadata

## GitHub commit flow

`POST /api/github/commit`:
- Requires same-origin `Origin`
- Requires active session
- Requires write scope (`repo` or `public_repo`); otherwise returns `WRITE_SCOPE_REQUIRED` + `reauthUrl`
- Validates payload bounds (owner/repo/branch/path/message/files count + size)
- Rejects path traversal and invalid commit paths
- Commits via GitHub git data API (blob/tree/commit/ref update)

Desktop commit path:
- `storageOptions.ts` uses backend commit for `storageKind: "github"`
- `CollectionsRepository` stages edited file content in `pendingGitFileContents`
- Commit clears `pendingGitPaths` and `pendingGitFileContents` on success

## GitHub webhook flow

`POST /api/github/webhook`:
- Requires `GITHUB_WEBHOOK_SECRET` to be configured
- Requires `X-Hub-Signature-256` and validates HMAC SHA-256 against the raw request payload
- Requires `X-GitHub-Event` header
- Parses JSON payload and returns:
  - `200` for `ping` events
  - `202` for other accepted events

## Test notes

Coverage added in `apps/desktop/test/`:
- `api.db.test.ts`: Neon SQL contract tested through `pg-mem` `newDb()`
- `api.config.test.ts`: `APP_ORIGIN` and `GITHUB_REDIRECT_URI` env inference/override behavior
- `api.validation.test.ts`: redirect + commit payload hardening checks
- `collectionsRepository.github.test.ts`: import/commit flow through backend stubs

## Build contract

- `apps/desktop/package.json` `build` runs backend compile first (`bun run build:api`) and then Vite static build.
- `build:api` uses `tsc -p tsconfig.api.json`, targeting CommonJS output in `api-build/`.
- `build:api` writes `api-build/package.json` with `{"type":"commonjs"}` so Node treats emitted `.js` as CommonJS at runtime.
- This avoids requiring `.js` suffixes in TypeScript source imports under `apps/desktop/api`.
