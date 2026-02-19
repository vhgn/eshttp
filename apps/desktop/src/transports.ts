import { invokeTauri, isTauriRuntime } from "./runtime";
import type { HttpTransport } from "./transport";

export function createDesktopTransport(): HttpTransport {
  if (isTauriRuntime()) {
    return {
      async send(request) {
        return invokeTauri("send_http", { request });
      },
    };
  }

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
