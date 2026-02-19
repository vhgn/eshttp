import Editor from "@monaco-editor/react";
import type { ChangeEvent, ComponentProps } from "react";
import { Button } from "../components/Button";
import { InlineMonacoInput } from "../components/InlineMonacoInput";
import { KeyValueTable } from "../components/KeyValueTable";
import type {
  BodyMode,
  HttpMethod,
  KeyValueRow,
  PanelTab,
  PayloadLanguage,
  ResponseTab,
} from "./types";
import { HTTP_METHODS } from "./types";

interface RequestWorkbenchViewProps {
  monacoTheme: string;
  beforeMountMonaco: ComponentProps<typeof Editor>["beforeMount"];
  method: HttpMethod;
  displayedUrl: string;
  panelTab: PanelTab;
  responseTab: ResponseTab;
  queryRows: KeyValueRow[];
  headerRows: KeyValueRow[];
  bearerToken: string;
  bodyMode: BodyMode;
  payloadLanguage: PayloadLanguage;
  editorBody: string;
  fileName: string | null;
  statusText: string;
  requestPreview: string;
  responseText: string;
  onMethodChange: (value: HttpMethod) => void;
  onUrlChange: (value: string) => void;
  onRunRequest: () => void;
  onSaveRequest: () => void;
  onPanelTabChange: (tab: PanelTab) => void;
  onResponseTabChange: (tab: ResponseTab) => void;
  onQueryRowChange: (
    rowId: string,
    nextValue: Partial<Pick<KeyValueRow, "key" | "value" | "enabled">>,
  ) => void;
  onHeaderRowChange: (
    rowId: string,
    nextValue: Partial<Pick<KeyValueRow, "key" | "value" | "enabled">>,
  ) => void;
  onAddQueryRow: () => void;
  onAddHeaderRow: () => void;
  onRemoveQueryRow: (rowId: string) => void;
  onRemoveHeaderRow: (rowId: string) => void;
  onBearerTokenChange: (value: string) => void;
  onBodyModeChange: (value: BodyMode) => void;
  onPayloadLanguageChange: (value: PayloadLanguage) => void;
  onEditorBodyChange: (value: string) => void;
  onBodyFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function RequestWorkbenchView({
  monacoTheme,
  beforeMountMonaco,
  method,
  displayedUrl,
  panelTab,
  responseTab,
  queryRows,
  headerRows,
  bearerToken,
  bodyMode,
  payloadLanguage,
  editorBody,
  fileName,
  statusText,
  requestPreview,
  responseText,
  onMethodChange,
  onUrlChange,
  onRunRequest,
  onSaveRequest,
  onPanelTabChange,
  onResponseTabChange,
  onQueryRowChange,
  onHeaderRowChange,
  onAddQueryRow,
  onAddHeaderRow,
  onRemoveQueryRow,
  onRemoveHeaderRow,
  onBearerTokenChange,
  onBodyModeChange,
  onPayloadLanguageChange,
  onEditorBodyChange,
  onBodyFileSelect,
}: RequestWorkbenchViewProps) {
  const panelShellClass =
    "overflow-hidden rounded-panel border border-stroke-default bg-[linear-gradient(180deg,var(--surface-primary),var(--surface-secondary))]";
  const tabButtonActiveClass =
    "bg-surface-tertiary border-[color-mix(in_srgb,var(--stroke-accent)_40%,var(--stroke-default))]";
  const controlSurfaceClass =
    "rounded-control border border-stroke-default bg-surface-secondary px-[0.55rem] py-[0.45rem] text-content-primary disabled:cursor-not-allowed disabled:opacity-60";
  const controlGridClass = "mb-[0.9rem] grid gap-[0.35rem] text-[0.9rem]";
  const editorBoxClass = "overflow-hidden rounded-[10px] border border-stroke-default";

  return (
    <main className="grid min-h-screen grid-rows-[auto_1fr_1fr] gap-[0.78rem] p-[0.9rem] max-[1080px]:grid-rows-[auto_auto_auto]">
      <header className="grid grid-cols-[112px_1fr_94px_94px] items-center gap-[0.6rem] max-[1080px]:grid-cols-2">
        <select
          className={controlSurfaceClass}
          value={method}
          onChange={(event) => onMethodChange(event.target.value as HttpMethod)}
        >
          {HTTP_METHODS.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>

        <InlineMonacoInput
          className="font-mono max-[1080px]:col-span-2"
          value={displayedUrl}
          onChange={onUrlChange}
          placeholder="https://api.example.com/v1/resource"
          theme={monacoTheme}
          beforeMount={beforeMountMonaco}
          ariaLabel="Request URL"
        />

        <Button variant="primary" className="font-semibold" onClick={onRunRequest}>
          Send
        </Button>
        <Button variant="accent" className="font-semibold" onClick={onSaveRequest}>
          Save
        </Button>
      </header>

      <section className={panelShellClass}>
        <nav className="flex gap-[0.45rem] border-b border-stroke-default p-[0.7rem]">
          <Button
            variant="tab"
            size="compact"
            className={panelTab === "params" ? tabButtonActiveClass : undefined}
            onClick={() => onPanelTabChange("params")}
          >
            Params
          </Button>
          <Button
            variant="tab"
            size="compact"
            className={panelTab === "headers" ? tabButtonActiveClass : undefined}
            onClick={() => onPanelTabChange("headers")}
          >
            Headers
          </Button>
          <Button
            variant="tab"
            size="compact"
            className={panelTab === "auth" ? tabButtonActiveClass : undefined}
            onClick={() => onPanelTabChange("auth")}
          >
            Auth
          </Button>
          <Button
            variant="tab"
            size="compact"
            className={panelTab === "body" ? tabButtonActiveClass : undefined}
            onClick={() => onPanelTabChange("body")}
          >
            Body
          </Button>
        </nav>

        {panelTab === "params" ? (
          <KeyValueTable
            rows={queryRows}
            keyPlaceholder="limit"
            valuePlaceholder="10"
            addLabel="Add Param"
            theme={monacoTheme}
            beforeMount={beforeMountMonaco}
            onRowChange={onQueryRowChange}
            onRemoveRow={onRemoveQueryRow}
            onAddRow={onAddQueryRow}
          />
        ) : null}

        {panelTab === "headers" ? (
          <KeyValueTable
            rows={headerRows}
            keyPlaceholder="Content-Type"
            valuePlaceholder="application/json"
            addLabel="Add Header"
            theme={monacoTheme}
            beforeMount={beforeMountMonaco}
            onRowChange={onHeaderRowChange}
            onRemoveRow={onRemoveHeaderRow}
            onAddRow={onAddHeaderRow}
          />
        ) : null}

        {panelTab === "auth" ? (
          <div className="p-[0.72rem]">
            <div className={controlGridClass}>
              <p className="m-0">Bearer Token</p>
              <InlineMonacoInput
                className="[--inline-input-bg:var(--surface-tertiary)]"
                value={bearerToken}
                onChange={onBearerTokenChange}
                placeholder="Paste JWT or access token"
                theme={monacoTheme}
                beforeMount={beforeMountMonaco}
                ariaLabel="Bearer token"
              />
            </div>
          </div>
        ) : null}

        {panelTab === "body" ? (
          <div className="p-[0.72rem]">
            <div className="mb-[0.66rem] flex items-center gap-[0.85rem]">
              <label className="inline-flex items-center gap-[0.35rem] text-content-muted">
                <input
                  className="accent-stroke-accent"
                  type="radio"
                  checked={bodyMode === "editor"}
                  onChange={() => onBodyModeChange("editor")}
                />
                Monaco Editor
              </label>
              <label className="inline-flex items-center gap-[0.35rem] text-content-muted">
                <input
                  className="accent-stroke-accent"
                  type="radio"
                  checked={bodyMode === "file"}
                  onChange={() => onBodyModeChange("file")}
                />
                File Upload
              </label>

              <select
                className={controlSurfaceClass}
                value={payloadLanguage}
                onChange={(event) => onPayloadLanguageChange(event.target.value as PayloadLanguage)}
                disabled={bodyMode !== "editor"}
              >
                <option value="json">JSON</option>
                <option value="graphql">GraphQL</option>
              </select>
            </div>

            {bodyMode === "editor" ? (
              <div className={editorBoxClass}>
                <Editor
                  height="360px"
                  theme={monacoTheme}
                  beforeMount={beforeMountMonaco}
                  language={payloadLanguage}
                  value={editorBody}
                  onChange={(value) => onEditorBodyChange(value ?? "")}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    tabSize: 2,
                    automaticLayout: true,
                  }}
                />
              </div>
            ) : (
              <div className="rounded-[10px] border border-stroke-default bg-surface-tertiary p-[0.8rem]">
                <input className={controlSurfaceClass} type="file" onChange={onBodyFileSelect} />
                <p className="mb-0 mt-[0.55rem] text-[0.86rem] text-content-muted">
                  {fileName ? `Attached: ${fileName}` : "No file attached"}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section className={panelShellClass}>
        <div className="flex items-center justify-between border-b border-stroke-default">
          <nav className="flex gap-[0.45rem] p-[0.55rem_0.7rem]">
            <Button
              variant="tab"
              size="compact"
              className={responseTab === "request" ? tabButtonActiveClass : undefined}
              onClick={() => onResponseTabChange("request")}
            >
              Request
            </Button>
            <Button
              variant="tab"
              size="compact"
              className={responseTab === "response" ? tabButtonActiveClass : undefined}
              onClick={() => onResponseTabChange("response")}
            >
              Response
            </Button>
          </nav>
          <p className="m-0 pr-[0.8rem] font-semibold text-content-muted">{statusText}</p>
        </div>

        {responseTab === "request" ? (
          <pre className="m-0 h-[calc(100%-49px)] overflow-auto whitespace-pre-wrap break-words p-[0.8rem] font-mono text-[0.86rem]">
            {requestPreview}
          </pre>
        ) : (
          <pre className="m-0 h-[calc(100%-49px)] overflow-auto whitespace-pre-wrap break-words p-[0.8rem] font-mono text-[0.86rem]">
            {responseText}
          </pre>
        )}
      </section>
    </main>
  );
}
