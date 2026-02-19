import Editor from "@monaco-editor/react";
import type { ComponentProps } from "react";
import { INLINE_MONACO_LANGUAGE_ID, registerInlineLanguage } from "../monaco/inlineLanguage";

interface InlineMonacoInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  theme: string;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
  beforeMount?: ComponentProps<typeof Editor>["beforeMount"];
}

type Monaco = Parameters<NonNullable<ComponentProps<typeof Editor>["beforeMount"]>>[0];

export function sanitizeSingleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ");
}

export function InlineMonacoInput({
  value,
  onChange,
  placeholder,
  theme,
  className,
  ariaLabel,
  disabled,
  beforeMount,
}: InlineMonacoInputProps) {
  const normalizedValue = sanitizeSingleLine(value);
  const classes = [
    "inline-monaco-root min-h-[34px] overflow-hidden rounded-control border border-stroke-default",
    "bg-[var(--inline-input-bg,var(--surface-secondary))] text-content-primary",
    "transition-[border-color,box-shadow] focus-within:border-stroke-accent",
    "focus-within:shadow-[0_0_0_1px_color-mix(in_srgb,var(--stroke-accent)_34%,transparent)]",
    disabled ? "opacity-80" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  function onBeforeMount(monaco: Monaco) {
    registerInlineLanguage(monaco);
    beforeMount?.(monaco);
  }

  return (
    <div className={classes}>
      <Editor
        height="34px"
        theme={theme}
        beforeMount={onBeforeMount}
        language={INLINE_MONACO_LANGUAGE_ID}
        value={normalizedValue}
        onChange={(nextValue) => onChange(sanitizeSingleLine(nextValue ?? ""))}
        options={{
          minimap: { enabled: false },
          lineNumbers: "off",
          glyphMargin: false,
          folding: false,
          lineDecorationsWidth: 0,
          lineNumbersMinChars: 0,
          renderLineHighlight: "none",
          scrollBeyondLastLine: false,
          scrollbar: {
            vertical: "hidden",
            horizontal: "auto",
            alwaysConsumeMouseWheel: false,
          },
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          wordWrap: "off",
          wrappingIndent: "none",
          acceptSuggestionOnEnter: "smart",
          quickSuggestions: true,
          suggestOnTriggerCharacters: true,
          suggest: {
            showWords: false,
          },
          tabSize: 2,
          fontSize: 13,
          fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
          padding: {
            top: 8,
            bottom: 8,
          },
          automaticLayout: true,
          ariaLabel,
          placeholder,
          readOnly: disabled,
        }}
      />
    </div>
  );
}
