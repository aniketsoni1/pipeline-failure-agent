import { z } from 'zod';
import { FAILURE_CATEGORIES } from './categories.js';

/** Runtime validation for the normalized model + config. */

export const severitySchema = z.enum(['info', 'warning', 'error', 'fatal']);
export const confidenceSchema = z.enum(['low', 'medium', 'high']);
export const failureCategorySchema = z.enum(FAILURE_CATEGORIES);

export const codeRefSchema = z.object({
  path: z.string(),
  line: z.number().int().positive().optional(),
  column: z.number().int().positive().optional(),
  symbol: z.string().optional(),
  revision: z.string().optional(),
});

export const logEventSchema = z.object({
  seq: z.number().int().nonnegative(),
  timestamp: z.string().optional(),
  severity: severitySchema,
  message: z.string(),
  source: z.string().optional(),
  code: codeRefSchema.optional(),
  redacted: z.boolean(),
});

export const sourceRefSchema = z.object({
  platform: z.string(),
  nativeId: z.string(),
  url: z.string().url().optional(),
  locator: z.record(z.string(), z.string()).optional(),
});

export const evidenceSchema = z.object({
  id: z.string(),
  kind: z.enum([
    'confirmed',
    'strong_correlation',
    'inference',
    'assumption',
    'missing_information',
  ]),
  statement: z.string(),
  sourceRef: sourceRefSchema.optional(),
  logSeq: z.number().int().optional(),
  codeRef: codeRefSchema.optional(),
});

export const recommendationSchema = z.object({
  id: z.string(),
  kind: z.enum(['verification', 'remediation']),
  description: z.string(),
  mutates: z.boolean(),
});

export const hypothesisSchema = z.object({
  id: z.string(),
  category: failureCategorySchema,
  title: z.string(),
  rationale: z.string(),
  confidence: confidenceSchema,
  score: z.number().min(0).max(1),
  evidence: z.array(evidenceSchema),
  recommendations: z.array(recommendationSchema),
});

/** Config file schema — validated on load. */
export const connectionConfigSchema = z.object({
  id: z.string().min(1),
  platform: z.string().min(1),
  label: z.string().min(1),
  credentialProvider: z.string().default('env'),
  mode: z.enum(['read-only', 'read-write']).default('read-only'),
  /** Non-secret settings (hosts, workspace ids, project keys). */
  settings: z.record(z.string(), z.string()).default({}),
});

export const aiConfigSchema = z.object({
  enabled: z.boolean().default(false),
  provider: z.string().optional(),
  model: z.string().optional(),
  maxTokens: z.number().int().positive().default(4000),
  requireApproval: z.boolean().default(true),
  maskFields: z.array(z.string()).default([]),
  excludeGlobs: z.array(z.string()).default([]),
});

export const securityConfigSchema = z.object({
  redaction: z.enum(['strict', 'standard', 'none']).default('strict'),
  maxLogChars: z.number().int().positive().default(200_000),
  telemetry: z.literal(false).default(false),
  retentionDays: z.number().int().nonnegative().default(7),
});

export const configSchema = z.object({
  version: z.literal(1).default(1),
  connections: z.array(connectionConfigSchema).default([]),
  // Functional defaults run the child schema so its own field defaults apply.
  // Written this way to be valid under both zod 3 and zod 4.
  ai: aiConfigSchema.default(() => aiConfigSchema.parse({})),
  security: securityConfigSchema.default(() => securityConfigSchema.parse({})),
});

export type ConnectionConfig = z.infer<typeof connectionConfigSchema>;
export type AiConfig = z.infer<typeof aiConfigSchema>;
export type SecurityConfig = z.infer<typeof securityConfigSchema>;
export type PfaConfig = z.infer<typeof configSchema>;
