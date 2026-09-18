import { UIMessageChunk } from "ai";
import { z } from "zod";
declare const runStreamCursorSchema: z.ZodString;
type RunStreamCursor = z.infer<typeof runStreamCursorSchema>;
declare const runStreamName: (runId: string) => string;
type RunStreamChunk = {
	runId: string;
	sequence: number;
	chunk: UIMessageChunk;
	cursor?: RunStreamCursor;
};
export { RunStreamChunk, RunStreamCursor, runStreamCursorSchema, runStreamName };
