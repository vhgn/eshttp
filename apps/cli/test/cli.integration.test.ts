import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../src/cli";
import { LocalFsCollectionSource } from "../src/localSource";
import type { HttpTransport } from "../src/transport";

describe("CLI integration", () => {
  let sandboxDir = "";
  const logs: string[] = [];
  const originalLog = console.log;

  beforeEach(async () => {
    sandboxDir = await mkdtemp(join(tmpdir(), "eshttp-cli-test-"));
    logs.length = 0;
    console.log = (...args: unknown[]) => {
      logs.push(args.map((value) => String(value)).join(" "));
    };
  });

  afterEach(async () => {
    console.log = originalLog;
    if (sandboxDir) {
      await rm(sandboxDir, { recursive: true, force: true });
    }
  });

  test("list discovers workspace, collection, and requests", async () => {
    const workspaceRoot = join(sandboxDir, ".eshttp", "workspaces", "team-api");
    const collectionDir = join(workspaceRoot, "users");

    await mkdir(collectionDir, { recursive: true });
    await writeFile(join(collectionDir, "List users.http"), "GET https://example.com/users");

    const source = new LocalFsCollectionSource(sandboxDir);
    await runCli(["list"], { cwd: sandboxDir, source });

    expect(logs.some((line) => line.includes("workspace team-api"))).toBeTrue();
    expect(logs.some((line) => line.includes("collection users"))).toBeTrue();
    expect(logs.some((line) => line.includes("List users"))).toBeTrue();
  });

  test("run resolves env placeholders with collection overriding workspace", async () => {
    const workspaceRoot = join(sandboxDir, ".eshttp", "workspaces", "team-api");
    const collectionDir = join(workspaceRoot, "users");
    const requestPath = join(collectionDir, "Get user.http");

    await mkdir(collectionDir, { recursive: true });

    await writeFile(
      requestPath,
      "GET https://api.example.com/{{RESOURCE}}\nAuthorization: Bearer {{TOKEN}}",
    );
    await writeFile(join(workspaceRoot, ".env.default"), "RESOURCE=users\nTOKEN=workspace");
    await writeFile(join(collectionDir, ".env.default"), "TOKEN=collection");

    let sentRequest:
      | {
          method: string;
          url: string;
          headers: Record<string, string>;
          body?: string;
        }
      | undefined;

    const send: HttpTransport["send"] = async (request) => {
      sentRequest = request;
      return {
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" },
        body: "{}",
      };
    };

    const source = new LocalFsCollectionSource(sandboxDir);
    const transport: HttpTransport = { send };

    await runCli(["run", requestPath], {
      cwd: sandboxDir,
      source,
      transport,
    });

    expect(sentRequest).toBeDefined();
    expect(sentRequest?.url).toBe("https://api.example.com/users");
    expect(sentRequest?.headers.Authorization).toBe("Bearer collection");
    expect(logs.some((line) => line.includes("200 OK"))).toBeTrue();
  });

  test("env command persists and reads active env", async () => {
    await runCli(["env", "dev"], { cwd: sandboxDir });
    await runCli(["env"], { cwd: sandboxDir });

    expect(logs.some((line) => line.includes("Active env set to dev"))).toBeTrue();
    expect(logs.some((line) => line.trim() === "dev")).toBeTrue();
  });
});
