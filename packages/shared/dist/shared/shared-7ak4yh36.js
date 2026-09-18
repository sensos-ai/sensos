// packages/shared/src/core.ts
import { z } from "zod";
var SENSOS_PROTOCOL_VERSIONS2 = [1];
var LATEST_SENSOS_PROTOCOL_VERSION2 = SENSOS_PROTOCOL_VERSIONS2[0];
var protocolVersionSchema2 = z.number().int().positive();
var supportedProtocolVersionsSchema2 = z.array(protocolVersionSchema2).min(1);
var protocolDiscoverySchema2 = z.object({
  protocolVersion: protocolVersionSchema2,
  supportedProtocolVersions: supportedProtocolVersionsSchema2
});
function negotiateProtocolVersion2(requested) {
  const requestedVersions = new Set(requested);
  return SENSOS_PROTOCOL_VERSIONS2.find((version) => requestedVersions.has(version));
}
var sessionActorKeySchema2 = z.tuple([
  z.string().min(1),
  z.string().min(1),
  z.string().min(1)
]);
function sessionActorKey2(input) {
  return sessionActorKeySchema2.parse([
    input.tenantId,
    input.userId,
    input.sessionId
  ]);
}
var protocolErrorCodeSchema2 = z.enum([
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "invalid_request",
  "protocol_mismatch",
  "credentials_required",
  "unavailable",
  "internal"
]);
var protocolErrorSchema2 = z.object({
  code: protocolErrorCodeSchema2,
  message: z.string(),
  retryable: z.boolean().default(false),
  details: z.record(z.string(), z.unknown()).optional()
});

export { SENSOS_PROTOCOL_VERSIONS2, LATEST_SENSOS_PROTOCOL_VERSION2, protocolVersionSchema2, supportedProtocolVersionsSchema2, protocolDiscoverySchema2, negotiateProtocolVersion2, sessionActorKeySchema2, sessionActorKey2, protocolErrorCodeSchema2, protocolErrorSchema2 };
