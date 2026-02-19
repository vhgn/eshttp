export function parseEnvText(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const normalized = text.replace(/\r\n/g, "\n");

  for (const rawLine of normalized.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

export function mergeEnvironment(
  workspaceEnv: Record<string, string>,
  collectionEnv: Record<string, string>,
): Record<string, string> {
  return {
    ...workspaceEnv,
    ...collectionEnv,
  };
}
