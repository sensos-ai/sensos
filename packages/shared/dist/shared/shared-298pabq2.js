// packages/shared/src/models.ts
import { z } from "zod";
var modelProviderSchema2 = z.enum(["gateway", "codex"]);
var modelRefSchema2 = z.object({
  provider: modelProviderSchema2,
  modelId: z.string().min(1)
});
var harnessFeaturesSchema2 = z.object({
  useMockModel: z.boolean()
});

export { modelProviderSchema2, modelRefSchema2, harnessFeaturesSchema2 };
