import { access, constants, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  buildRequest,
  type Collection,
  loadWorkspaceTree,
  mergeEnvironment,
  parseEnvText,
  type RequestFile,
  type Workspace,
} from "@eshttp/core";
import { LocalFsCollectionSource } from "./localSource.js";
import { createNodeFetchTransport } from "./nodeTransport.js";
import type { HttpTransport } from "./transport.js";

interface ParsedArgs {
  command: string;
  positionals: string[];
  options: Record<string, string | boolean>;
}

const ACTIVE_ENV_FILE = ".eshttp/active-env";

function parseArgs(argv: string[]): ParsedArgs {
  const [command = "help", ...rest] = argv;
  const positionals: string[] = [];
  const options: Record<string, string | boolean> = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === undefined) {
      continue;
    }

    if (token.startsWith("--")) {
      const key = token.slice(2);
      const value = rest[index + 1];
      if (!value || value.startsWith("--")) {
        options[key] = true;
      } else {
        options[key] = value;
        index += 1;
      }
      continue;
    }

    positionals.push(token);
  }

  return {
    command,
    positionals,
    options,
  };
}

function printHelp(): void {
  console.log(
    `eshttp commands:\n  eshttp list\n  eshttp run <request-path-or-title> [--env <name>]\n  eshttp env [name]`,
  );
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function findRequestByLocator(
  locator: string,
  source: LocalFsCollectionSource,
): Promise<{
  workspace: Workspace;
  collection: Collection;
  request: RequestFile;
}> {
  const resolvedLocator = resolve(locator);

  if (await exists(resolvedLocator)) {
    const trees = await loadWorkspaceTree(source);
    for (const tree of trees) {
      for (const node of tree.collections) {
        for (const request of node.requests) {
          if (resolve(request.uri) === resolvedLocator) {
            return {
              workspace: tree.workspace,
              collection: node.collection,
              request,
            };
          }
        }
      }
    }

    throw new Error(`Request file exists but is outside known workspaces: ${locator}`);
  }

  const trees = await loadWorkspaceTree(source);
  const matches: Array<{
    workspace: Workspace;
    collection: Collection;
    request: RequestFile;
  }> = [];

  for (const tree of trees) {
    for (const node of tree.collections) {
      for (const request of node.requests) {
        if (request.title === locator || request.uri.endsWith(locator)) {
          matches.push({
            workspace: tree.workspace,
            collection: node.collection,
            request,
          });
        }
      }
    }
  }

  if (matches.length === 0) {
    throw new Error(`No request found for locator: ${locator}`);
  }

  if (matches.length > 1) {
    throw new Error(`Multiple requests match locator '${locator}'. Use a full file path instead.`);
  }

  const match = matches[0];
  if (!match) {
    throw new Error(`No request found for locator: ${locator}`);
  }

  return match;
}

async function readCombinedEnv(
  source: LocalFsCollectionSource,
  scopeUri: string,
  envName: string,
): Promise<string> {
  const defaultEnv = await source.readEnvironmentFile(scopeUri, "default");
  const selectedEnv =
    envName === "default" ? null : await source.readEnvironmentFile(scopeUri, envName);

  return [defaultEnv ?? "", selectedEnv ?? ""].filter(Boolean).join("\n");
}

async function getActiveEnvName(cwd: string): Promise<string> {
  const path = resolve(cwd, ACTIVE_ENV_FILE);
  if (!(await exists(path))) {
    return "default";
  }

  const value = await readFile(path, "utf8");
  const normalized = value.trim();
  return normalized || "default";
}

async function setActiveEnvName(cwd: string, name: string): Promise<void> {
  const path = resolve(cwd, ACTIVE_ENV_FILE);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${name}\n`, "utf8");
}

async function handleList(source: LocalFsCollectionSource): Promise<void> {
  const trees = await loadWorkspaceTree(source);

  if (trees.length === 0) {
    console.log("No workspaces found. Checked cwd and user config workspace roots.");
    return;
  }

  for (const tree of trees) {
    console.log(`workspace ${tree.workspace.name} (${tree.workspace.uri})`);

    if (tree.collections.length === 0) {
      console.log("  (no collections)");
      continue;
    }

    for (const node of tree.collections) {
      console.log(`  collection ${node.collection.name}`);
      for (const request of node.requests) {
        console.log(`    - ${request.title} -> ${request.uri}`);
      }
    }
  }
}

async function handleRun(
  source: LocalFsCollectionSource,
  transport: HttpTransport,
  locator: string,
  envName: string,
): Promise<void> {
  const { workspace, collection, request } = await findRequestByLocator(locator, source);

  const requestText = await source.readRequestText(request);
  const workspaceEnvText = await readCombinedEnv(source, workspace.uri, envName);
  const collectionEnvText = await readCombinedEnv(source, collection.uri, envName);

  const mergedWorkspace = parseEnvText(workspaceEnvText);
  const mergedCollection = parseEnvText(collectionEnvText);

  const mergedText = Object.entries(mergeEnvironment(mergedWorkspace, mergedCollection))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const built = buildRequest({
    title: request.title,
    requestText,
    workspaceEnvText: "",
    collectionEnvText: mergedText,
  });

  const response = await transport.send({
    method: built.builtRequest.method,
    url: built.builtRequest.url,
    headers: built.builtRequest.headers,
    body: built.builtRequest.body,
  });

  console.log(`${response.status} ${response.statusText}`);
  if (Object.keys(response.headers).length > 0) {
    console.log("\nHeaders:");
    for (const [key, value] of Object.entries(response.headers)) {
      console.log(`${key}: ${value}`);
    }
  }
  console.log("\nBody:\n");
  console.log(response.body);
}

async function handleEnv(args: string[], cwd: string): Promise<void> {
  const name = args[0];
  if (!name) {
    console.log(await getActiveEnvName(cwd));
    return;
  }

  await setActiveEnvName(cwd, name);
  console.log(`Active env set to ${name}`);
}

export interface CliRuntimeOptions {
  cwd?: string;
  source?: LocalFsCollectionSource;
  transport?: HttpTransport;
}

export async function runCli(argv: string[], options: CliRuntimeOptions = {}): Promise<void> {
  const parsed = parseArgs(argv);
  const cwd = options.cwd ?? process.cwd();
  const source = options.source ?? new LocalFsCollectionSource(cwd);
  const transport = options.transport ?? createNodeFetchTransport();

  switch (parsed.command) {
    case "list":
      await handleList(source);
      return;
    case "run": {
      const locator = parsed.positionals[0];
      if (!locator) {
        throw new Error("Usage: eshttp run <request-path-or-title> [--env <name>]");
      }
      const envFromFlag = parsed.options.env;
      const envName = typeof envFromFlag === "string" ? envFromFlag : await getActiveEnvName(cwd);
      await handleRun(source, transport, locator, envName);
      return;
    }
    case "env":
      await handleEnv(parsed.positionals, cwd);
      return;
    default:
      printHelp();
  }
}
