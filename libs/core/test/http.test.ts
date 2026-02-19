import { describe, expect, test } from "bun:test";
import { mergeEnvironment, parseEnvText, parseHttpRequestText, resolveHttpRequest } from "../src";

describe("parseHttpRequestText", () => {
  test("parses a request with headers and body", () => {
    const parsed = parseHttpRequestText(
      `POST https://api.example.com/users\nAuthorization: Bearer {{TOKEN}}\nContent-Type: application/json\n\n{"name":"Ada"}`,
      "Create user",
    );

    expect(parsed.method).toBe("POST");
    expect(parsed.url).toBe("https://api.example.com/users");
    expect(parsed.headers.Authorization).toBe("Bearer {{TOKEN}}");
    expect(parsed.body).toBe('{"name":"Ada"}');
  });
});

describe("resolveHttpRequest", () => {
  test("renders placeholders", () => {
    const parsed = parseHttpRequestText(
      `GET https://{{HOST}}/health\nX-Api-Key: {{TOKEN}}`,
      "Health",
    );

    const resolved = resolveHttpRequest(parsed, {
      HOST: "example.com",
      TOKEN: "abc",
    });

    expect(resolved.url).toBe("https://example.com/health");
    expect(resolved.headers["X-Api-Key"]).toBe("abc");
  });

  test("throws when variable is missing", () => {
    const parsed = parseHttpRequestText(`GET https://{{HOST}}/health`, "Health");

    expect(() => resolveHttpRequest(parsed, {})).toThrow("Missing environment variables");
  });
});

describe("parseEnvText and mergeEnvironment", () => {
  test("workspace env is overridden by collection env", () => {
    const workspace = parseEnvText("HOST=workspace.example.com\nTOKEN=123");
    const collection = parseEnvText("HOST=collection.example.com");

    const merged = mergeEnvironment(workspace, collection);
    expect(merged.HOST).toBe("collection.example.com");
    expect(merged.TOKEN).toBe("123");
  });
});
