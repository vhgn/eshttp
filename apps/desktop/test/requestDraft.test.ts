import { describe, expect, test } from "bun:test";
import {
  composeRequestText,
  createDefaultRequestDraft,
  parseRequestTextToDraft,
  setDraftSyncParamsWithUrl,
  updateDraftUrl,
} from "../src/requestDraft";

describe("request draft helpers", () => {
  test("parses structured request text into a draft", () => {
    const draft = parseRequestTextToDraft(
      'POST https://api.example.com/users?limit=10\nAuthorization: Bearer TOKEN\nX-Trace: 1\n\n{"ok":true}',
      "create-user",
    );

    expect(draft.method).toBe("POST");
    expect(draft.baseUrl).toBe("https://api.example.com/users");
    expect(draft.queryRows).toHaveLength(1);
    expect(draft.queryRows[0]?.key).toBe("limit");
    expect(draft.queryRows[0]?.value).toBe("10");
    expect(draft.bearerToken).toBe("TOKEN");
    expect(draft.headerRows).toEqual([
      expect.objectContaining({
        key: "X-Trace",
        value: "1",
        enabled: true,
      }),
    ]);
    expect(draft.payloadLanguage).toBe("json");
    expect(draft.editorBody).toBe('{"ok":true}');
  });

  test("keeps invalid request files editable by falling back to raw body state", () => {
    const draft = parseRequestTextToDraft("just some text", "notes");

    expect(draft.method).toBe("GET");
    expect(draft.baseUrl).toBe("https://httpbin.org/get");
    expect(draft.editorBody).toBe("just some text");
    expect(draft.payloadLanguage).toBe("graphql");
  });

  test("url updates only rewrite params when sync is enabled", () => {
    const draft = createDefaultRequestDraft();

    const unsynced = updateDraftUrl(
      {
        ...draft,
        syncParamsWithUrl: false,
      },
      "https://api.example.com/users?limit=10",
    );
    expect(unsynced.baseUrl).toBe("https://api.example.com/users?limit=10");
    expect(unsynced.queryRows).toEqual([]);

    const synced = updateDraftUrl(draft, "https://api.example.com/users?limit=10");
    expect(synced.baseUrl).toBe("https://api.example.com/users");
    expect(synced.queryRows).toHaveLength(1);
    expect(synced.queryRows[0]?.key).toBe("limit");
  });

  test("enabling sync normalizes query params already embedded in the base url", () => {
    const draft = {
      ...createDefaultRequestDraft(),
      baseUrl: "https://api.example.com/users?limit=10",
      syncParamsWithUrl: false,
    };

    const synced = setDraftSyncParamsWithUrl(draft, true);

    expect(synced.baseUrl).toBe("https://api.example.com/users");
    expect(synced.queryRows).toHaveLength(1);
    expect(synced.queryRows[0]?.key).toBe("limit");
  });

  test("request text is rebuilt from the draft shape", () => {
    const requestText = composeRequestText({
      ...createDefaultRequestDraft(),
      method: "POST",
      baseUrl: "https://api.example.com/users",
      queryRows: [
        {
          id: "limit",
          key: "limit",
          value: "10",
          enabled: true,
        },
      ],
      headerRows: [
        {
          id: "trace",
          key: "X-Trace",
          value: "1",
          enabled: true,
        },
      ],
      bearerToken: "TOKEN",
      editorBody: '{"ok":true}',
    });

    expect(requestText).toBe(
      'POST https://api.example.com/users?limit=10\nX-Trace: 1\nAuthorization: Bearer TOKEN\n\n{"ok":true}',
    );
  });
});
