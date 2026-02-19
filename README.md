# eshttp

![eshttp social preview](files/social-preview.png)

`eshttp` is a fast HTTP workflow tool with a CLI-first experience today.

Desktop downloads will be added later.

## Download

Clone this repository:

```bash
git clone https://github.com/vhgn/eshttp.git
cd eshttp
```

Install dependencies:

```bash
bun install
```

## Use the CLI

The CLI supports:

- `eshttp list`
- `eshttp run <request-path-or-title> [--env <name>]`
- `eshttp env [name]`

Run CLI commands from source:

```bash
bun run --filter @eshttp/cli dev -- list
```

## Quick Start

Create a workspace, a request file, and an environment file:

```bash
mkdir -p .eshttp/workspaces/demo/users
cat > ".eshttp/workspaces/demo/users/List users.http" <<'EOF'
GET https://{{HOST}}/users
Authorization: Bearer {{TOKEN}}
EOF

cat > ".eshttp/workspaces/demo/.env.default" <<'EOF'
HOST=api.example.com
TOKEN=replace-me
EOF
```

List discovered requests:

```bash
bun run --filter @eshttp/cli dev -- list
```

Run a request:

```bash
bun run --filter @eshttp/cli dev -- run ".eshttp/workspaces/demo/users/List users.http"
```
