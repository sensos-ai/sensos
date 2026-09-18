import { z } from "zod";
declare const SENSOS_PROTOCOL_VERSIONS: readonly [1];
declare const LATEST_SENSOS_PROTOCOL_VERSION: 1;
type SensosProtocolVersion = (typeof SENSOS_PROTOCOL_VERSIONS)[number];
declare const protocolVersionSchema: z.ZodNumber;
declare const supportedProtocolVersionsSchema: z.ZodArray<z.ZodNumber>;
declare const protocolDiscoverySchema: z.ZodObject<{
	protocolVersion: z.ZodNumber;
	supportedProtocolVersions: z.ZodArray<z.ZodNumber>;
}, z.core.$strip>;
type ProtocolDiscovery = z.infer<typeof protocolDiscoverySchema>;
declare function negotiateProtocolVersion(requested: readonly number[]): SensosProtocolVersion | undefined;
declare const sessionActorKeySchema: z.ZodTuple<[z.ZodString, z.ZodString, z.ZodString], null>;
type SessionActorKey = z.infer<typeof sessionActorKeySchema>;
declare function sessionActorKey(input: {
	tenantId: string;
	userId: string;
	sessionId: string;
}): SessionActorKey;
declare const protocolErrorCodeSchema: z.ZodEnum<{
	conflict: "conflict";
	credentials_required: "credentials_required";
	forbidden: "forbidden";
	internal: "internal";
	invalid_request: "invalid_request";
	not_found: "not_found";
	protocol_mismatch: "protocol_mismatch";
	unauthorized: "unauthorized";
	unavailable: "unavailable";
}>;
declare const protocolErrorSchema: z.ZodObject<{
	code: z.ZodEnum<{
		conflict: "conflict";
		credentials_required: "credentials_required";
		forbidden: "forbidden";
		internal: "internal";
		invalid_request: "invalid_request";
		not_found: "not_found";
		protocol_mismatch: "protocol_mismatch";
		unauthorized: "unauthorized";
		unavailable: "unavailable";
	}>;
	message: z.ZodString;
	retryable: z.ZodDefault<z.ZodBoolean>;
	details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
type ProtocolError = z.infer<typeof protocolErrorSchema>;
export { LATEST_SENSOS_PROTOCOL_VERSION, ProtocolDiscovery, ProtocolError, SENSOS_PROTOCOL_VERSIONS, SensosProtocolVersion, SessionActorKey, negotiateProtocolVersion, protocolDiscoverySchema, protocolErrorCodeSchema, protocolErrorSchema, protocolVersionSchema, sessionActorKey, sessionActorKeySchema, supportedProtocolVersionsSchema };
