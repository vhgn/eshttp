# Inline Monaco Placeholder UX

Scope:
- `apps/desktop/src/components/InlineMonacoInput.tsx`
- `apps/desktop/src/monaco/inlineLanguage.ts`
- `apps/desktop/src/App.tsx`

## Inline input constraints

`InlineMonacoInput` is always single-line:
- `sanitizeSingleLine()` replaces all CR/LF sequences with spaces.
- The component sanitizes both initial value and `onChange` values.

It uses custom language id `eshttp-inline`.

## Language tokenization

`registerInlineLanguage()` sets a Monarch tokenizer:
- `{{` and `}}` delimiters are tokenized as `placeholder.delimiter`.
- placeholder key token is `placeholder.key`.
- invalid brace usage is tokenized as `invalid`.

Language and completion provider are registered once per session (module-level flags).

## Completion behavior

`setInlineCompletionEnvKeys(keys)` sets global suggestion candidates after normalization.

Normalization rules (`normalizeInlineEnvKeys`):
- trim
- keep only keys matching `^[A-Z0-9_]+$`
- dedupe and sort

Completion context (`getPlaceholderCompletionContext`):
- active only when cursor is inside an open `{{ ...` expression
- prefix is uppercased before filtering
- replacement range includes trailing `}}` if already present

Suggestions insert `<KEY>}}` and use `Variable` completion kind.

## How env keys reach Monaco

`App.tsx` loads workspace + collection env text for the selected request/environment, merges them with core `mergeEnvironment`, then calls:
- `setInlineCompletionEnvKeys(Object.keys(mergedEnv))`

When no selection exists or env read fails, keys are reset to empty.
