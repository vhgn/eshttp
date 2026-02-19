import { describe, expect, test } from "bun:test";
import { normalizeReturnTo } from "../api/_lib/http";
import { validateCommitPayload } from "../api/_lib/validation";

describe("api validation", () => {
  test("normalizeReturnTo blocks open redirect", () => {
    const result = normalizeReturnTo("https://evil.example/attack", "https://app.example.com");
    expect(result).toBe("/");
  });

  test("validateCommitPayload rejects path traversal", () => {
    const payload = validateCommitPayload({
      owner: "octocat",
      repo: "hello-world",
      branch: "main",
      workspacePath: ".eshttp/workspaces/demo",
      message: "sync",
      files: {
        "../secret.txt": "oops",
      },
    });

    expect(payload).toBeNull();
  });

  test("validateCommitPayload accepts bounded valid payload", () => {
    const payload = validateCommitPayload({
      owner: "octocat",
      repo: "hello-world",
      branch: "main",
      workspacePath: ".eshttp/workspaces/demo",
      message: "sync workspace",
      files: {
        "users/list.http": "GET https://example.com/users",
      },
    });

    expect(payload).not.toBeNull();
    expect(payload?.files["users/list.http"]).toContain("GET");
  });
});
