import type * as MonacoEditor from "monaco-editor";

export const INLINE_MONACO_LANGUAGE_ID = "eshttp-inline";

const ENV_KEY_PATTERN = /^[A-Z0-9_]+$/;

let inlineLanguageRegistered = false;
let inlineCompletionRegistered = false;
let completionDisposable: MonacoEditor.IDisposable | null = null;
let activeEnvKeys: string[] = [];

type Monaco = typeof MonacoEditor;

interface PlaceholderCompletionContext {
  keyPrefix: string;
  replaceStartColumn: number;
  replaceEndColumn: number;
}

export function normalizeInlineEnvKeys(keys: string[]): string[] {
  const normalized = new Set<string>();

  for (const key of keys) {
    const candidate = key.trim();
    if (!candidate || !ENV_KEY_PATTERN.test(candidate)) {
      continue;
    }

    normalized.add(candidate);
  }

  return [...normalized].sort((left, right) => left.localeCompare(right));
}

export function setInlineCompletionEnvKeys(keys: string[]): void {
  activeEnvKeys = normalizeInlineEnvKeys(keys);
}

export function getPlaceholderCompletionContext(
  lineContent: string,
  column: number,
): PlaceholderCompletionContext | null {
  const cursorIndex = Math.max(0, column - 1);
  const linePrefix = lineContent.slice(0, cursorIndex);

  const openIndex = linePrefix.lastIndexOf("{{");
  if (openIndex < 0) {
    return null;
  }

  const placeholderPrefix = linePrefix.slice(openIndex + 2);
  if (placeholderPrefix.includes("}}")) {
    return null;
  }

  if (!/^\s*[A-Za-z0-9_]*$/.test(placeholderPrefix)) {
    return null;
  }

  const lineSuffix = lineContent.slice(cursorIndex);
  const closingMatch = lineSuffix.match(/^\s*\}\}/);

  return {
    keyPrefix: placeholderPrefix.trim().toUpperCase(),
    replaceStartColumn: openIndex + 3,
    replaceEndColumn: closingMatch ? column + closingMatch[0].length : column,
  };
}

export function filterInlineSuggestionKeys(keys: string[], keyPrefix: string): string[] {
  const normalizedKeys = normalizeInlineEnvKeys(keys);
  if (!keyPrefix) {
    return normalizedKeys;
  }

  return normalizedKeys.filter((key) => key.startsWith(keyPrefix));
}

export function registerInlineLanguage(monaco: Monaco): void {
  if (!inlineLanguageRegistered) {
    if (!monaco.languages.getLanguages().some((entry) => entry.id === INLINE_MONACO_LANGUAGE_ID)) {
      monaco.languages.register({ id: INLINE_MONACO_LANGUAGE_ID });
    }

    monaco.languages.setMonarchTokensProvider(INLINE_MONACO_LANGUAGE_ID, {
      tokenizer: {
        root: [
          [/\{\{/, { token: "placeholder.delimiter", next: "@placeholder" }],
          [/[{}]/, "invalid"],
          [/[^{}]+/, ""],
        ],
        placeholder: [
          [/\s+/, "white"],
          [/[A-Z0-9_]+/, "placeholder.key"],
          [/\}\}/, { token: "placeholder.delimiter", next: "@pop" }],
          [/./, "invalid"],
        ],
      },
    });

    inlineLanguageRegistered = true;
  }

  if (!inlineCompletionRegistered) {
    completionDisposable = monaco.languages.registerCompletionItemProvider(
      INLINE_MONACO_LANGUAGE_ID,
      {
        triggerCharacters: ["{"],
        provideCompletionItems(model, position) {
          const lineContent = model.getLineContent(position.lineNumber);
          const context = getPlaceholderCompletionContext(lineContent, position.column);

          if (!context) {
            return { suggestions: [] };
          }

          const candidates = filterInlineSuggestionKeys(activeEnvKeys, context.keyPrefix);
          if (candidates.length === 0) {
            return { suggestions: [] };
          }

          const suggestions = candidates.map((key) => ({
            label: key,
            kind: monaco.languages.CompletionItemKind.Variable,
            detail: "Environment secret",
            insertText: `${key}}}`,
            range: {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: context.replaceStartColumn,
              endColumn: context.replaceEndColumn,
            },
          }));

          return { suggestions };
        },
      },
    );

    inlineCompletionRegistered = true;
  }

  if (completionDisposable === null) {
    inlineCompletionRegistered = false;
  }
}
