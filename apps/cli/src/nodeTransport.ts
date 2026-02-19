import type { HttpTransport } from "./transport.js";

export function createNodeFetchTransport(): HttpTransport {
  return {
    async send(request) {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });

      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: await response.text(),
      };
    },
  };
}
