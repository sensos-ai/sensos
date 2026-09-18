import { z } from "zod";
declare const modelProviderSchema: z.ZodEnum<{
	codex: "codex";
	gateway: "gateway";
}>;
declare const modelRefSchema: z.ZodObject<{
	provider: z.ZodEnum<{
		codex: "codex";
		gateway: "gateway";
	}>;
	modelId: z.ZodString;
}, z.core.$strip>;
type ModelProvider = z.infer<typeof modelProviderSchema>;
type ModelRef = z.infer<typeof modelRefSchema>;
declare const harnessFeaturesSchema: z.ZodObject<{
	useMockModel: z.ZodBoolean;
}, z.core.$strip>;
type HarnessFeatures = z.output<typeof harnessFeaturesSchema>;
type HarnessFeatureOverrides = Partial<HarnessFeatures>;
export { HarnessFeatureOverrides, HarnessFeatures, ModelProvider, ModelRef, harnessFeaturesSchema, modelProviderSchema, modelRefSchema };
