import type { ComponentProps } from "react";
import type Editor from "@monaco-editor/react";
import { registerInlineLanguage } from "./monaco/inlineLanguage";
import type { AccentOption, Option, ThemeName } from "./views/types";

type Monaco = Parameters<NonNullable<ComponentProps<typeof Editor>["beforeMount"]>>[0];

interface MonacoThemeDefinition {
  base: "vs" | "vs-dark";
  inherit: boolean;
  rules: Array<{ token: string; foreground: string; fontStyle?: string }>;
  colors: Record<string, string>;
}

interface AppThemeDefinition {
  monacoTheme: string;
  accents: AccentOption[];
  definition: MonacoThemeDefinition;
}

const APP_THEME_DEFINITIONS: Record<ThemeName, AppThemeDefinition> = {
  black: {
    monacoTheme: "eshttp-black",
    accents: [
      { token: "accent-1", label: "Primary", value: "#6bcf6a" },
      { token: "accent-2", label: "Mint", value: "#84d1a0" },
      { token: "accent-3", label: "Amber", value: "#d79b67" },
      { token: "accent-4", label: "Sky", value: "#66b3ff" },
      { token: "accent-5", label: "Rose", value: "#de7f95" },
    ],
    definition: {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "8D8D8D", fontStyle: "italic" },
        { token: "string", foreground: "A8CF76" },
        { token: "number", foreground: "D79B67" },
        { token: "keyword", foreground: "6BCF6A" },
        { token: "type", foreground: "84D1A0" },
        { token: "delimiter", foreground: "CCCCCC" },
        { token: "placeholder.delimiter", foreground: "6BCF6A" },
        { token: "placeholder.key", foreground: "84D1A0", fontStyle: "bold" },
      ],
      colors: {
        "editor.background": "#121212",
        "editor.foreground": "#F2F2F2",
        "editor.lineHighlightBackground": "#181818",
        "editorCursor.foreground": "#6BCF6A",
        "editorLineNumber.foreground": "#595959",
        "editorLineNumber.activeForeground": "#AAAAAA",
        "editor.selectionBackground": "#254327",
        "editor.inactiveSelectionBackground": "#1B2D1D",
        "editorWhitespace.foreground": "#323232",
        "editorIndentGuide.background1": "#2A2A2A",
        "editorIndentGuide.activeBackground1": "#414141",
        "editorGutter.background": "#121212",
      },
    },
  },
  light: {
    monacoTheme: "eshttp-light",
    accents: [
      { token: "accent-1", label: "Primary", value: "#2d8d37" },
      { token: "accent-2", label: "Teal", value: "#286e60" },
      { token: "accent-3", label: "Amber", value: "#a05a2c" },
      { token: "accent-4", label: "Sky", value: "#2f74c9" },
      { token: "accent-5", label: "Rose", value: "#b44d6f" },
    ],
    definition: {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment", foreground: "7A7A7A", fontStyle: "italic" },
        { token: "string", foreground: "3F7D42" },
        { token: "number", foreground: "A05A2C" },
        { token: "keyword", foreground: "2D8D37" },
        { token: "type", foreground: "286E60" },
        { token: "delimiter", foreground: "505050" },
        { token: "placeholder.delimiter", foreground: "2D8D37" },
        { token: "placeholder.key", foreground: "286E60", fontStyle: "bold" },
      ],
      colors: {
        "editor.background": "#FFFFFF",
        "editor.foreground": "#131313",
        "editor.lineHighlightBackground": "#F5F7F5",
        "editorCursor.foreground": "#2D8D37",
        "editorLineNumber.foreground": "#A3A3A3",
        "editorLineNumber.activeForeground": "#5B5B5B",
        "editor.selectionBackground": "#CCE8CF",
        "editor.inactiveSelectionBackground": "#DFEFE1",
        "editorWhitespace.foreground": "#D9D9D9",
        "editorIndentGuide.background1": "#E6E6E6",
        "editorIndentGuide.activeBackground1": "#CBCBCB",
        "editorGutter.background": "#FFFFFF",
      },
    },
  },
  soft: {
    monacoTheme: "eshttp-soft",
    accents: [
      { token: "accent-1", label: "Primary", value: "#8cb66b" },
      { token: "accent-2", label: "Moss", value: "#b0c6a3" },
      { token: "accent-3", label: "Sand", value: "#c8a379" },
      { token: "accent-4", label: "Sky", value: "#7da9d8" },
      { token: "accent-5", label: "Rose", value: "#cb8ea0" },
    ],
    definition: {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "8D8D8D", fontStyle: "italic" },
        { token: "string", foreground: "A5BE8A" },
        { token: "number", foreground: "C8A379" },
        { token: "keyword", foreground: "8CB66B" },
        { token: "type", foreground: "B0C6A3" },
        { token: "delimiter", foreground: "C9C9C9" },
        { token: "placeholder.delimiter", foreground: "8CB66B" },
        { token: "placeholder.key", foreground: "B0C6A3", fontStyle: "bold" },
      ],
      colors: {
        "editor.background": "#202020",
        "editor.foreground": "#E2E2E2",
        "editor.lineHighlightBackground": "#292929",
        "editorCursor.foreground": "#8CB66B",
        "editorLineNumber.foreground": "#707070",
        "editorLineNumber.activeForeground": "#B0B0B0",
        "editor.selectionBackground": "#3A4731",
        "editor.inactiveSelectionBackground": "#313C2A",
        "editorWhitespace.foreground": "#3E3E3E",
        "editorIndentGuide.background1": "#383838",
        "editorIndentGuide.activeBackground1": "#505050",
        "editorGutter.background": "#202020",
      },
    },
  },
  gruvbox: {
    monacoTheme: "eshttp-gruvbox",
    accents: [
      { token: "accent-1", label: "Primary", value: "#b8bb26" },
      { token: "accent-2", label: "Green", value: "#8ec07c" },
      { token: "accent-3", label: "Orange", value: "#d79921" },
      { token: "accent-4", label: "Blue", value: "#83a598" },
      { token: "accent-5", label: "Red", value: "#fb4934" },
    ],
    definition: {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "928374", fontStyle: "italic" },
        { token: "string", foreground: "B8BB26" },
        { token: "number", foreground: "D79921" },
        { token: "keyword", foreground: "FB4934" },
        { token: "type", foreground: "8EC07C" },
        { token: "delimiter", foreground: "D5C4A1" },
        { token: "placeholder.delimiter", foreground: "FE8019" },
        { token: "placeholder.key", foreground: "B8BB26", fontStyle: "bold" },
      ],
      colors: {
        "editor.background": "#282828",
        "editor.foreground": "#EBDBB2",
        "editor.lineHighlightBackground": "#32302F",
        "editorCursor.foreground": "#FE8019",
        "editorLineNumber.foreground": "#7C6F64",
        "editorLineNumber.activeForeground": "#A89984",
        "editor.selectionBackground": "#504945",
        "editor.inactiveSelectionBackground": "#3C3836",
        "editorWhitespace.foreground": "#5A524C",
        "editorIndentGuide.background1": "#4A4440",
        "editorIndentGuide.activeBackground1": "#665C54",
        "editorGutter.background": "#282828",
      },
    },
  },
};

export const APP_THEME_CONFIG = APP_THEME_DEFINITIONS;

export const APP_THEME_OPTIONS = [
  { value: "black", label: "Black" },
  { value: "light", label: "Light" },
  { value: "soft", label: "Soft" },
  { value: "gruvbox", label: "Gruvbox" },
] as const satisfies ReadonlyArray<Option<ThemeName>>;

export const ACCENTS_BY_THEME = Object.fromEntries(
  Object.entries(APP_THEME_DEFINITIONS).map(([themeName, definition]) => [
    themeName,
    definition.accents,
  ]),
) as Record<ThemeName, AccentOption[]>;

export const MONACO_THEME_BY_APP_THEME = Object.fromEntries(
  Object.entries(APP_THEME_DEFINITIONS).map(([themeName, definition]) => [
    themeName,
    definition.monacoTheme,
  ]),
) as Record<ThemeName, string>;

let monacoThemesRegistered = false;

export function registerMonacoThemes(monaco: Monaco) {
  registerInlineLanguage(monaco);
  if (monacoThemesRegistered) {
    return;
  }

  for (const definition of Object.values(APP_THEME_DEFINITIONS)) {
    monaco.editor.defineTheme(definition.monacoTheme, definition.definition);
  }

  monacoThemesRegistered = true;
}
