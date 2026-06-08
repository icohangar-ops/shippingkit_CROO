#!/usr/bin/env bun
// Local CAP conformance harness. Run with: bun run scripts/test-shipkit.ts
// Exits non-zero if any fixture fails its expected outcome — wire into CI
// before deploying ShipKit outputs.

import { validateCapCode } from "../src/lib/cap-validator";
import { simulateProviderLifecycle } from "../src/lib/cap-mock-runtime";

type Fixture = {
  name: string;
  source: string;
  expect: "pass" | "fail";
};

const GOOD_PROVIDER = `import { AgentClient, EventType, DeliverableType, isInsufficientBalance } from '@croo-network/sdk';
const client = new AgentClient(
  { baseURL: process.env.CROO_API_URL!, wsURL: process.env.CROO_WS_URL! },
  process.env.CROO_SDK_KEY!,
);
const seen = new Set<string>();
const stream = await client.connectWebSocket();
stream.on(EventType.NegotiationCreated, async (e) => { await client.acceptNegotiation(e.negotiation_id); });
stream.on(EventType.OrderPaid, async (e) => {
  if (seen.has(e.order_id)) return;
  seen.add(e.order_id);
  const content = await runWork(e.order_id);
  await client.deliverOrder(e.order_id, { type: DeliverableType.Text, content });
});
stream.on(EventType.OrderCompleted, (e) => {});
`;

const BAD_PROVIDER_INVENTED = `import { cap } from 'cap-sdk';
cap.serve('research', async (req) => {
  const out = await runWork(req);
  return cap.settle(out);
});
`;

const GOOD_REQUESTER = `import { AgentClient } from '@croo-network/sdk';
const client = new AgentClient(
  { baseURL: process.env.CROO_API_URL!, wsURL: process.env.CROO_WS_URL! },
  process.env.CROO_SDK_KEY!,
);
const negotiation = await client.negotiateOrder({ service_id: '<service-id>', input: { q: 'hello' } });
await client.payOrder(negotiation.order_id);
const delivery = await client.getDelivery(negotiation.order_id);
`;

const FIXTURES: Fixture[] = [
  { name: "good provider", source: GOOD_PROVIDER, expect: "pass" },
  { name: "invented cap.serve()", source: BAD_PROVIDER_INVENTED, expect: "fail" },
  { name: "good requester", source: GOOD_REQUESTER, expect: "pass" },
];

let exit = 0;
for (const f of FIXTURES) {
  const report = validateCapCode(f.source);
  const ok = report.failed === 0;
  const got = ok ? "pass" : "fail";
  const status = got === f.expect ? "OK " : "FAIL";
  if (status === "FAIL") exit = 1;

  console.log(`\n[${status}] ${f.name} → ${got} (expected ${f.expect})`);
  console.log(`       kind=${report.kind}  score=${report.score}  errors=${report.failed}`);

  for (const c of report.checks.filter((c) => !c.passed && c.severity === "error")) {
    console.log(`       ✗ ${c.label}${c.detail ? "  — " + c.detail : ""}`);
  }

  if (report.kind === "provider") {
    const trace = simulateProviderLifecycle(f.source);
    console.log(`       lifecycle: ${trace.summary}`);
  }
}

console.log(
  exit === 0 ? "\n✓ all fixtures matched expectations" : "\n✗ fixture mismatch — see above",
);
process.exit(exit);