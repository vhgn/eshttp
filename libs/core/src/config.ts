import { EshttpError } from "./errors";
import { type DiscoveryConfig, DiscoveryConfigSchema } from "./schemas";

function escapeRegex(value: string): string {
  return value.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

function globToRegex(pattern: string): RegExp {
  const escaped = escapeRegex(pattern)
    .replace(/\*\*/g, "::DOUBLE_STAR::")
    .replace(/\*/g, "[^/]*")
    .replace(/::DOUBLE_STAR::/g, ".*");

  return new RegExp(`^${escaped}$`);
}

export function parseDiscoveryConfig(rawText: string | undefined): DiscoveryConfig | null {
  if (!rawText) {
    return null;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch (error) {
    throw new EshttpError(
      "DISCOVERY_CONFIG_ERROR",
      `Invalid .eshttp.json format: ${(error as Error).message}`,
    );
  }

  const parsed = DiscoveryConfigSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new EshttpError(
      "DISCOVERY_CONFIG_ERROR",
      parsed.error.issues.map((issue) => issue.message).join("; "),
    );
  }

  return parsed.data;
}

export function pathIncludedByConfig(
  relativePath: string,
  config: DiscoveryConfig | null,
): boolean {
  if (!config) {
    return true;
  }

  const normalizedPath = relativePath.replaceAll("\\", "/");

  const excluded = config.exclude.some((pattern) => globToRegex(pattern).test(normalizedPath));
  if (excluded) {
    return false;
  }

  if (config.include.length === 0) {
    return true;
  }

  return config.include.some((pattern) => globToRegex(pattern).test(normalizedPath));
}

export function getEntryPatterns(config: DiscoveryConfig | null): string[] {
  if (!config || config.entries.length === 0) {
    return ["**"];
  }

  return config.entries;
}

export function matchesEntryPattern(relativePath: string, config: DiscoveryConfig | null): boolean {
  const normalizedPath = relativePath.replaceAll("\\", "/");
  return getEntryPatterns(config).some((pattern) => globToRegex(pattern).test(normalizedPath));
}
