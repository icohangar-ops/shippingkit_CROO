import {
  CAP_DELIVERABLE_TYPES,
  CAP_ENV_VARS,
  CAP_EVENT_TYPES,
  CAP_FORBIDDEN_PATTERNS,
  CAP_PROVIDER_METHODS,
  CAP_REQUESTER_METHODS,
  CAP_SDK_PACKAGE,
  type CapCheck,
} from "./cap-spec";

export type ValidationKind = "provider" | "requester";

export type ValidationReport = {
  kind: ValidationKind;
  score: number; // 0–100
  passed: number;
  failed: number;
  checks: CapCheck[];
};

function check(
  id: string,
  label: string,
  severity: CapCheck["severity"],
  passed: boolean,
  detail?: string,
): CapCheck {
  return { id, label, severity, passed, detail };
}

function detectKind(code: string): ValidationKind {
  // Requester code calls negotiateOrder/payOrder; provider listens on
  // events and calls acceptNegotiation/deliverOrder.
  const isRequester = /\bnegotiateOrder\s*\(|\bpayOrder\s*\(/.test(code);
  const isProvider = /\bacceptNegotiation\s*\(|\bdeliverOrder\s*\(|connectWebSocket|EventType\./.test(code);
  if (isRequester && !isProvider) return "requester";
  return "provider";
}

export function validateCapCode(
  source: string,
  forcedKind?: ValidationKind,
): ValidationReport {
  const code = source ?? "";
  const kind = forcedKind ?? detectKind(code);
  const checks: CapCheck[] = [];

  // --- Universal ---
  checks.push(
    check(
      "sdk-import",
      `Imports from ${CAP_SDK_PACKAGE}`,
      "error",
      new RegExp(`from\\s+["']${CAP_SDK_PACKAGE.replace("/", "\\/")}["']`).test(code),
      "Required: import { AgentClient, EventType, DeliverableType } from '@croo-network/sdk'",
    ),
  );

  checks.push(
    check(
      "agent-client",
      "Constructs new AgentClient(config, sdkKey)",
      "error",
      /new\s+AgentClient\s*\(/.test(code),
    ),
  );

  const envHits = CAP_ENV_VARS.filter((v) => code.includes(`process.env.${v}`));
  checks.push(
    check(
      "env-driven",
      "Reads CROO_API_URL / CROO_WS_URL / CROO_SDK_KEY from process.env",
      "error",
      envHits.length >= 3,
      `Found: ${envHits.join(", ") || "none"}`,
    ),
  );

  // --- Forbidden patterns ---
  for (const { pattern, reason } of CAP_FORBIDDEN_PATTERNS) {
    const hit = pattern.test(code);
    checks.push(
      check(
        `forbidden:${pattern.source}`,
        `Avoid: ${reason}`,
        "error",
        !hit,
        hit ? "Pattern detected — remove before shipping." : undefined,
      ),
    );
  }

  if (kind === "provider") {
    checks.push(
      check(
        "ws-connect",
        "Opens WebSocket via client.connectWebSocket()",
        "error",
        /\.connectWebSocket\s*\(/.test(code),
      ),
    );

    const eventHits = CAP_EVENT_TYPES.filter((e) =>
      new RegExp(`EventType\\.${e}\\b`).test(code),
    );
    checks.push(
      check(
        "event-types",
        "Subscribes via EventType.* (not string literals)",
        "error",
        eventHits.length > 0,
        `Subscribed events: ${eventHits.join(", ") || "none"}`,
      ),
    );

    checks.push(
      check(
        "negotiation-handler",
        "Handles NegotiationCreated → acceptNegotiation()",
        "error",
        /NegotiationCreated[\s\S]{0,400}acceptNegotiation/.test(code),
      ),
    );

    checks.push(
      check(
        "order-paid-handler",
        "Handles OrderPaid → deliverOrder()",
        "error",
        /OrderPaid[\s\S]{0,600}deliverOrder/.test(code),
      ),
    );

    const dtHits = CAP_DELIVERABLE_TYPES.filter((t) =>
      new RegExp(`DeliverableType\\.${t}\\b`).test(code),
    );
    checks.push(
      check(
        "deliverable-type",
        "Uses DeliverableType.Text or DeliverableType.Schema",
        "error",
        dtHits.length > 0,
        `Used: ${dtHits.join(", ") || "none"}`,
      ),
    );

    checks.push(
      check(
        "idempotency",
        "Guards against duplicate OrderPaid (idempotency)",
        "error",
        /getDelivery|already.*deliver|delivered\?|seen\.has|processed\.has/i.test(code),
        "Required: check getDelivery() or a local Set before re-running work — a duplicate OrderPaid must not trigger a second on-chain delivery (money-loss risk).",
      ),
    );
  } else {
    // requester
    const reqHits = CAP_REQUESTER_METHODS.filter((m) =>
      new RegExp(`\\.${m}\\s*\\(`).test(code),
    );
    checks.push(
      check(
        "requester-flow",
        "Calls negotiateOrder + payOrder",
        "error",
        reqHits.includes("negotiateOrder") && reqHits.includes("payOrder"),
        `Found: ${reqHits.join(", ") || "none"}`,
      ),
    );

    checks.push(
      check(
        "fetch-delivery",
        "Fetches result via getDelivery() / getOrder()",
        "warn",
        /\.getDelivery\s*\(|\.getOrder\s*\(/.test(code),
      ),
    );
  }

  // Error handling
  checks.push(
    check(
      "error-typed",
      "Uses APIError typed helpers (isInsufficientBalance, isNotFound, …)",
      "warn",
      /\bis(NotFound|Unauthorized|InvalidParams|InvalidStatus|Forbidden|InsufficientBalance)\s*\(/.test(code),
    ),
  );

  // Provider-method usage sanity
  if (kind === "provider") {
    const providerHits = CAP_PROVIDER_METHODS.filter((m) =>
      new RegExp(`\\.${m}\\s*\\(`).test(code),
    );
    checks.push(
      check(
        "provider-methods",
        "Uses only documented provider methods",
        "info",
        true,
        `Calls: ${providerHits.join(", ") || "none"}`,
      ),
    );
  }

  const failed = checks.filter((c) => !c.passed && c.severity === "error").length;
  const warned = checks.filter((c) => !c.passed && c.severity === "warn").length;
  const passed = checks.filter((c) => c.passed).length;
  const total = checks.length;
  const score = Math.round(
    ((passed + (total - passed - failed - warned) * 0) / total) * 100,
  );

  return { kind, score, passed, failed, checks };
}