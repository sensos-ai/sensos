import {
  supportedProtocolVersionsSchema2
} from "./shared-7ak4yh36.js";
import {
  modelRefSchema2,
  harnessFeaturesSchema2
} from "./shared-298pabq2.js";

// packages/shared/src/session.ts
import { z } from "zod";
var runStatusSchema2 = z.enum([
  "queued",
  "running",
  "cancel_requested",
  "completed",
  "failed",
  "cancelled",
  "interrupted"
]);
var sessionInputSchema2 = z.object({
  supportedProtocolVersions: supportedProtocolVersionsSchema2,
  sessionId: z.string().min(1),
  catalogRevision: z.number().int().nonnegative().optional(),
  cwd: z.string().min(1),
  model: modelRefSchema2.optional(),
  instructions: z.string().optional(),
  initialMessages: z.array(z.custom()).optional(),
  features: harnessFeaturesSchema2.partial().optional()
});

export { runStatusSchema2, sessionInputSchema2 };
