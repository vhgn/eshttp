import { z } from "zod";

export const HttpMethodSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[A-Z]+$/);

export const HttpHeaderMapSchema = z.record(z.string(), z.string());

export const ParsedHttpRequestSchema = z.object({
  title: z.string().min(1),
  method: HttpMethodSchema,
  url: z.string().min(1),
  headers: HttpHeaderMapSchema.default({}),
  body: z.string().optional(),
});

export const ResolvedHttpRequestSchema = ParsedHttpRequestSchema.extend({
  missingVariables: z.array(z.string()).default([]),
});

export const DiscoveryConfigSchema = z
  .object({
    entries: z.array(z.string().min(1)).default([]),
    include: z.array(z.string().min(1)).default([]),
    exclude: z.array(z.string().min(1)).default([]),
  })
  .strict();

export const WorkspaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  uri: z.string().min(1),
});

export const CollectionSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  name: z.string().min(1),
  uri: z.string().min(1),
});

export const RequestSchema = z.object({
  id: z.string().min(1),
  collectionId: z.string().min(1),
  title: z.string().min(1),
  uri: z.string().min(1),
});

export type ParsedHttpRequest = z.infer<typeof ParsedHttpRequestSchema>;
export type ResolvedHttpRequest = z.infer<typeof ResolvedHttpRequestSchema>;
export type DiscoveryConfig = z.infer<typeof DiscoveryConfigSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;
export type Collection = z.infer<typeof CollectionSchema>;
export type RequestFile = z.infer<typeof RequestSchema>;
