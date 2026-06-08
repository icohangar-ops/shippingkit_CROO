import {
  CAP_DELIVERABLE_TYPES,
  CAP_EVENT_TYPES,
} from "./cap-spec";

// A best-effort mock runtime: it does NOT execute the user's TypeScript.
// Instead, it walks the canonical event lifecycle and reports which steps
// the code would have handled, based on textual evidence. This lets the
// harness print a "what would happen" trace without sandbox eval.

export type LifecycleStep = {
  step: number;
  event: (typeof CAP_EVENT_TYPES)[number] | "boot" | "delivery";
  expected: string;
  handled: boolean;
  evidence?: string;
};

export type LifecycleTrace = {
  steps: LifecycleStep[];
  summary: string;
};

function find(code: string, re: RegExp): string | undefined {
  const m = code.match(re);
  return m?.[0]?.slice(0, 120);
}

export function simulateProviderLifecycle(code: string): LifecycleTrace {
  const steps: LifecycleStep[] = [];

  steps.push({
    step: 1,
    event: "boot",
    expected: "Construct AgentClient with API URL + WS URL + SDK key",
    handled: /new\s+AgentClient\s*\([\s\S]{0,200}CROO_(API|WS|SDK)/.test(code),
    evidence: find(code, /new\s+AgentClient\s*\([^)]{0,200}\)/),
  });

  steps.push({
    step: 2,
    event: "boot",
    expected: "Open WebSocket via client.connectWebSocket()",
    handled: /\.connectWebSocket\s*\(\s*\)/.test(code),
    evidence: find(code, /\.connectWebSocket\s*\([^)]*\)/),
  });

  steps.push({
    step: 3,
    event: "NegotiationCreated",
    expected: "On NegotiationCreated → acceptNegotiation(negotiation_id)",
    handled: /NegotiationCreated[\s\S]{0,400}acceptNegotiation\s*\(/.test(code),
    evidence: find(code, /NegotiationCreated[\s\S]{0,200}acceptNegotiation\s*\([^)]*\)/),
  });

  steps.push({
    step: 4,
    event: "OrderCreated",
    expected: "OrderCreated emitted by chain (no provider action required)",
    handled: true,
  });

  steps.push({
    step: 5,
    event: "OrderPaid",
    expected: "On OrderPaid → run work, then deliverOrder(order_id, { type, content })",
    handled: /OrderPaid[\s\S]{0,600}deliverOrder\s*\(/.test(code),
    evidence: find(code, /OrderPaid[\s\S]{0,400}deliverOrder\s*\([^)]*\)/),
  });

  const dt = CAP_DELIVERABLE_TYPES.find((t) =>
    new RegExp(`DeliverableType\\.${t}\\b`).test(code),
  );
  steps.push({
    step: 6,
    event: "delivery",
    expected: "Deliverable typed as DeliverableType.Text or .Schema",
    handled: !!dt,
    evidence: dt ? `DeliverableType.${dt}` : undefined,
  });

  steps.push({
    step: 7,
    event: "OrderCompleted",
    expected: "OrderCompleted received after on-chain settlement (USDC released)",
    handled: /OrderCompleted/.test(code),
    evidence: find(code, /OrderCompleted[\s\S]{0,120}/),
  });

  const handledCount = steps.filter((s) => s.handled).length;
  const summary = `${handledCount}/${steps.length} lifecycle steps wired. ${
    handledCount === steps.length ? "Ready to publish to the Agent Store." : "Fix unhandled steps before listing."
  }`;

  return { steps, summary };
}