import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { buildRequest, loadWorkspaceTree } from "eshttp-core";
import { createCollectionSource } from "../src/sources";
import { createDesktopTransport } from "../src/transports";

describe("Desktop integration", () => {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    Object.defineProperty(globalThis, "window", {
      value: {},
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
    globalThis.fetch = originalFetch;
  });

  test("browser source provides loadable workspace tree", async () => {
    const source = createCollectionSource();
    const tree = await loadWorkspaceTree(source);

    expect(tree.length).toBe(1);
    expect(tree[0]?.workspace.name).toBe("demo");
    expect(tree[0]?.collections[0]?.requests[0]?.title).toBe("Get ip");
  });

  test("browser transport sends built request", async () => {
    globalThis.fetch = (async () =>
      new Response('{"ok":true}', {
        status: 200,
        statusText: "OK",
        headers: {
          "content-type": "application/json",
        },
      })) as unknown as typeof fetch;

    const transport = createDesktopTransport();
    const built = buildRequest({
      title: "Health",
      requestText: "GET https://example.com/{{PATH}}",
      workspaceEnvText: "PATH=health",
    });

    const response = await transport.send({
      method: built.builtRequest.method,
      url: built.builtRequest.url,
      headers: built.builtRequest.headers,
      body: built.builtRequest.body,
    });

    expect(response.status).toBe(200);
    expect(response.body).toContain("ok");
  });
});
