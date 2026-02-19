import { mergeEnvironment, parseEnvText } from "./env";
import { parseHttpRequestText, resolveHttpRequest } from "./http";

export interface ExecuteRequestInput {
  title: string;
  requestText: string;
  workspaceEnvText?: string;
  collectionEnvText?: string;
}

export function buildRequest(input: ExecuteRequestInput) {
  const parsedRequest = parseHttpRequestText(input.requestText, input.title);

  const workspaceEnv = input.workspaceEnvText ? parseEnvText(input.workspaceEnvText) : {};
  const collectionEnv = input.collectionEnvText ? parseEnvText(input.collectionEnvText) : {};

  const environment = mergeEnvironment(workspaceEnv, collectionEnv);
  const builtRequest = resolveHttpRequest(parsedRequest, environment);

  return {
    parsedRequest,
    builtRequest,
    environment,
  };
}
