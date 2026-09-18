// packages/shared/src/streams.ts
import { z } from "zod";
var runStreamCursorSchema2 = z.string().min(1);
var runStreamName2 = (runId) => `sensos/runs/${encodeURIComponent(runId)}`;

export { runStreamCursorSchema2, runStreamName2 };
