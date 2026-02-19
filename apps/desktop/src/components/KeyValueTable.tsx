import type Editor from "@monaco-editor/react";
import type { ComponentProps } from "react";
import type { KeyValueRow } from "../views/types";
import { Button } from "./Button";
import { InlineMonacoInput } from "./InlineMonacoInput";

interface KeyValueTableProps {
  rows: KeyValueRow[];
  keyPlaceholder: string;
  valuePlaceholder: string;
  addLabel: string;
  theme: string;
  beforeMount: ComponentProps<typeof Editor>["beforeMount"];
  onRowChange: (
    rowId: string,
    nextValue: Partial<Pick<KeyValueRow, "key" | "value" | "enabled">>,
  ) => void;
  onRemoveRow: (rowId: string) => void;
  onAddRow: () => void;
}

export function KeyValueTable({
  rows,
  keyPlaceholder,
  valuePlaceholder,
  addLabel,
  theme,
  beforeMount,
  onRowChange,
  onRemoveRow,
  onAddRow,
}: KeyValueTableProps) {
  return (
    <div className="grid grid-cols-[1fr_1fr_74px_96px] items-center gap-[0.5rem] p-[0.72rem] max-[1080px]:grid-cols-1">
      <div className="text-[0.82rem] text-content-muted">Key</div>
      <div className="text-[0.82rem] text-content-muted">Value</div>
      <div className="text-[0.82rem] text-content-muted">Enabled</div>
      <div />

      {rows.map((row) => (
        <div className="contents" key={row.id}>
          <InlineMonacoInput
            value={row.key}
            onChange={(nextValue) => onRowChange(row.id, { key: nextValue })}
            placeholder={keyPlaceholder}
            theme={theme}
            beforeMount={beforeMount}
            ariaLabel={`${addLabel} key`}
          />
          <InlineMonacoInput
            value={row.value}
            onChange={(nextValue) => onRowChange(row.id, { value: nextValue })}
            placeholder={valuePlaceholder}
            theme={theme}
            beforeMount={beforeMount}
            ariaLabel={`${addLabel} value`}
          />
          <input
            className="mx-auto h-[18px] w-[18px] accent-stroke-accent"
            type="checkbox"
            checked={row.enabled}
            onChange={(event) => onRowChange(row.id, { enabled: event.target.checked })}
          />
          <Button variant="danger" onClick={() => onRemoveRow(row.id)}>
            Remove
          </Button>
        </div>
      ))}

      <Button variant="secondary" className="col-span-2 max-[1080px]:col-span-1" onClick={onAddRow}>
        {addLabel}
      </Button>
    </div>
  );
}
