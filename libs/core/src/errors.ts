export type EshttpErrorCode =
  | "REQUEST_PARSE_ERROR"
  | "REQUEST_VALIDATION_ERROR"
  | "MISSING_ENV_VARIABLES"
  | "DISCOVERY_CONFIG_ERROR";

export class EshttpError extends Error {
  readonly code: EshttpErrorCode;

  constructor(code: EshttpErrorCode, message: string) {
    super(message);
    this.name = "EshttpError";
    this.code = code;
  }
}

export class MissingEnvVariablesError extends EshttpError {
  readonly missingVariables: string[];

  constructor(missingVariables: string[]) {
    super("MISSING_ENV_VARIABLES", `Missing environment variables: ${missingVariables.join(", ")}`);
    this.name = "MissingEnvVariablesError";
    this.missingVariables = missingVariables;
  }
}
