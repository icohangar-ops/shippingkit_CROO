// Canonical surface of @croo-network/sdk that ShipKit outputs must match.
// Sourced from docs.croo.network. Keep this file as the single source of
// truth for both the static validator and the mock runtime harness.

export const CAP_SDK_PACKAGE = "@croo-network/sdk";

export const CAP_ENV_VARS = [
  "CROO_API_URL",
  "CROO_WS_URL",
  "CROO_SDK_KEY",
] as const;

export const CAP_PROVIDER_METHODS = [
  "acceptNegotiation",
  "acceptNegotiationWithFundAddress",
  "rejectNegotiation",
  "deliverOrder",
  "rejectOrder",
] as const;

export const CAP_REQUESTER_METHODS = [
  "negotiateOrder",
  "payOrder",
  "getOrder",
  "getDelivery",
] as const;

export const CAP_EVENT_TYPES = [
  "NegotiationCreated",
  "NegotiationRejected",
  "NegotiationExpired",
  "OrderCreated",
  "OrderPaid",
  "OrderCompleted",
  "OrderRejected",
  "OrderExpired",
] as const;

export const CAP_DELIVERABLE_TYPES = ["Text", "Schema"] as const;

export const CAP_ERROR_HELPERS = [
  "isNotFound",
  "isUnauthorized",
  "isInvalidParams",
  "isInvalidStatus",
  "isForbidden",
  "isInsufficientBalance",
] as const;

// Patterns that prove old/invented APIs (must NOT appear in output).
export const CAP_FORBIDDEN_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\bcap\.serve\s*\(/, reason: "cap.serve() is invented — Services are registered in the Dashboard, not in code." },
  { pattern: /\bcap\.price\s*\(/, reason: "cap.price() does not exist — pricing is set in the Dashboard." },
  { pattern: /\bcap\.settle\s*\(/, reason: "cap.settle() does not exist — use deliverOrder()." },
  { pattern: /agent\.manifest\.json/, reason: "agent.manifest.json is not a CAP concept — use the Configure wizard." },
  { pattern: /\bhandler\.ts\b/, reason: "handler.ts pattern was illustrative — real providers wire WebSocket events in provider.ts." },
  { pattern: /\bhold\s+(ETH|gas)\b/i, reason: "Gas is sponsored by the platform — never ask users to hold ETH." },
];

export type CapCheck = {
  id: string;
  label: string;
  severity: "error" | "warn" | "info";
  passed: boolean;
  detail?: string;
};