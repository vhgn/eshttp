# Contributing

## Releases

Package publishing is driven by GitHub Releases, not by `push` to `main`.

### Tag format

Use one of these tag formats:

- `core-vX.Y.Z` or `eshttp-core@X.Y.Z`
- `cli-vX.Y.Z` or `eshttp@X.Y.Z`

Examples:

- `core-v0.2.0`
- `cli-v0.2.0`
- `core-v1.0.0-rc.1`

### What happens on release creation

- If the tag is `core-*`, the workflow publishes `libs/core` as `eshttp-core` with the exact version from the tag.
- If the tag is `cli-*`, the workflow publishes `apps/cli` as `eshttp` with the exact version from the tag.
- For CLI releases, `eshttp-core` dependency is pinned to `^<release-version>` before publish.

### How to create a release

1. Push a tag using one of the formats above.
2. In GitHub, create a new Release for that tag.
3. When the release is created, `Publish Packages` workflow runs and publishes the matching package.

If the tag format is invalid, the workflow fails fast with an error.
