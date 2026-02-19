import { describe, expect, test } from "bun:test";
import { sanitizeSingleLine } from "../src/components/InlineMonacoInput";
import {
  filterInlineSuggestionKeys,
  getPlaceholderCompletionContext,
  normalizeInlineEnvKeys,
} from "../src/monaco/inlineLanguage";

describe("Inline Monaco helpers", () => {
  test("sanitizeSingleLine removes newlines", () => {
    expect(sanitizeSingleLine("alpha\nbeta\r\ngamma")).toBe("alpha beta gamma");
  });

  test("normalizeInlineEnvKeys keeps valid env placeholders only", () => {
    expect(normalizeInlineEnvKeys(["TOKEN", "token", "API_KEY", "", "TOKEN", "A-B"])).toEqual([
      "API_KEY",
      "TOKEN",
    ]);
  });

  test("extracts placeholder completion context for partial key", () => {
    const line = "https://api.example.com/{{tok";
    const context = getPlaceholderCompletionContext(line, line.length + 1);

    expect(context).toEqual({
      keyPrefix: "TOK",
      replaceStartColumn: line.indexOf("{{") + 3,
      replaceEndColumn: line.length + 1,
    });
  });

  test("completion context consumes closing braces when present", () => {
    const line = "{{TOK}}";
    const context = getPlaceholderCompletionContext(line, 6);

    expect(context).toEqual({
      keyPrefix: "TOK",
      replaceStartColumn: 3,
      replaceEndColumn: 8,
    });
  });

  test("returns no context for invalid placeholder expression", () => {
    expect(getPlaceholderCompletionContext("value {{to-k", 12)).toBeNull();
  });

  test("filters suggestions by prefix", () => {
    const keys = ["TOKEN", "TOPIC", "API_KEY"];
    expect(filterInlineSuggestionKeys(keys, "TO")).toEqual(["TOKEN", "TOPIC"]);
    expect(filterInlineSuggestionKeys(keys, "")).toEqual(["API_KEY", "TOKEN", "TOPIC"]);
  });
});
