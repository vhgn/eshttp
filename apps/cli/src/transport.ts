export interface HttpTransport {
  send(request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  }): Promise<{
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
  }>;
}
