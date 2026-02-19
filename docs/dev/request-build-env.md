# Request Parsing, Env Merge, and Placeholder Resolution

Scope:
- `libs/core/src/http.ts`
- `libs/core/src/env.ts`
- `libs/core/src/executor.ts`
- `libs/core/src/errors.ts`

## Request text parsing

`parseHttpRequestText(text, title)` expects:
1. First non-empty, non-comment line: `METHOD URL`
2. Optional header lines: `Header-Name: value`
3. Blank line separator
4. Optional body (remaining lines)

Validation uses zod schemas from `libs/core/src/schemas.ts`.

Parse errors:
- malformed request line -> `REQUEST_PARSE_ERROR`
- malformed header line -> `REQUEST_PARSE_ERROR`
- schema validation failure -> `REQUEST_VALIDATION_ERROR`

## Placeholder format

Placeholders are uppercase env keys only:
- pattern: `{{ KEY }}` where key matches `[A-Z0-9_]+`

Resolution runs over URL, all header values, and body. Missing keys across all fields are collected and de-duplicated.

If any are missing, `resolveHttpRequest()` throws `MissingEnvVariablesError` (`MISSING_ENV_VARIABLES`).

## Env parsing and merge precedence

`parseEnvText()`:
- ignores blank lines and `#` comments
- ignores invalid lines without `=`
- strips matching single or double quotes around values

`mergeEnvironment(workspaceEnv, collectionEnv)` is shallow merge where collection values override workspace values.

## End-to-end builder

`buildRequest()` composes all steps:
1. parse request text
2. parse env text for workspace + collection
3. merge env maps
4. resolve placeholders

Return shape:
- `parsedRequest`
- `builtRequest`
- `environment`
