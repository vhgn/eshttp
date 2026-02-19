# Desktop Vercel GitHub Backend

Scope:
- `apps/desktop/vercel.json`
- `apps/desktop/.env.example`
- `apps/desktop/api/**`
- `apps/desktop/src/data/storageOptions.ts`
- `apps/desktop/src/data/collectionsRepository.ts`

## Deployment surface

`apps/desktop/vercel.json` configures:
- Vite static build output (`dist`)
- Node.js Vercel Functions for `api/**/*.ts`
- Explicit routed API endpoints:
  - `/api/auth/github/start`
  - `/api/auth/github/callback`
  - `/api/auth/github/session`
  - `/api/github/workspaces`
  - `/api/github/commit`

## Environment contract

Required vars in `apps/desktop/.env.example`:
- `APP_ORIGIN`
- `DATABASE_URL` (Neon)
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_REDIRECT_URI`
- `SESSION_ENCRYPTION_KEY` (base64url 32-byte key)

Optional:
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

## Test notes

Coverage added in `apps/desktop/test/`:
- `api.db.test.ts`: Neon SQL contract tested through `pg-mem` `newDb()`
- `api.validation.test.ts`: redirect + commit payload hardening checks
- `collectionsRepository.github.test.ts`: import/commit flow through backend stubs
