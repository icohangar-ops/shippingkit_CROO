#!/usr/bin/env bun
// End-to-end test for ShipKit provider outputs.
//
//   bun --preload ./tests/preload.ts scripts/e2e-shipkit.ts \
//     [--provider <path>] [--mode mock|live] [--timeout 8000]
//
// mock mode (default): boots the in-process mock SDK, loads the provider
//   file, fires the canonical lifecycle, and asserts each handler ran.
// live mode: requires CROO_API_URL/CROO_WS_URL/CROO_SDK_KEY and the real
//   @croo-network/sdk; opens a WebSocket and reports observed events.

import path from "node:path";
import fs from "node:fs";
import { parseArgs } from "node:util";
import { __harness, EventType } from "../tests/mocks/croo-network-sdk";

const { values } = parseArgs({
  options: {
    provider: { type: "string", default: "tests/fixtures/sample-provider.ts" },
    mode: { type: "string", default: "mock" },
    timeout: { type: "string", default: "8000" },
    "expect-type": { type: "string", default: "text" }, // text | schema
    "report-dir": { type: "string", default: "reports" },
    "report-name": { type: "string", default: "" },
    "no-report": { type: "boolean", default: false },
  },
});

const MODE = values.mode as "mock" | "live";
const TIMEOUT = Number(values.timeout);
const EXPECT_TYPE = values["expect-type"] as "text" | "schema";
const PROVIDER_PATH = path.resolve(process.cwd(), values.provider!);
const REPORT_DIR = path.resolve(process.cwd(), values["report-dir"]!);
const REPORT_NAME =
  values["report-name"] ||
  `e2e-${path.basename(PROVIDER_PATH).replace(/\.[tj]sx?$/, "")}-${Date.now()}`;
const WRITE_REPORT = !values["no-report"];

type TimelineEntry = {
  ts: number;
  phase: "boot" | "subscribe" | "event" | "call" | "assert";
  label: string;
  status: "ok" | "fail" | "warn" | "info";
  detail?: string;
  expected?: unknown;
  actual?: unknown;
  diff?: string;
};

const timeline: TimelineEntry[] = [];
const t0 = Date.now();

function record(entry: Omit<TimelineEntry, "ts">) {
  timeline.push({ ts: Date.now() - t0, ...entry });
}

function diffJSON(expected: unknown, actual: unknown): string | undefined {
  const e = JSON.stringify(expected, null, 2);
  const a = JSON.stringify(actual, null, 2);
  if (e === a) return undefined;
  return `--- expected\n${e}\n+++ actual\n${a}`;
}

const C = {
  ok: (s: string, extra?: Partial<TimelineEntry>) => {
    console.log(`\x1b[32m✓\x1b[0m ${s}`);
    record({ phase: "assert", label: s, status: "ok", ...extra });
  },
  fail: (s: string, extra?: Partial<TimelineEntry>): never => {
    console.error(`\x1b[31m✗ ${s}\x1b[0m`);
    record({ phase: "assert", label: s, status: "fail", ...extra });
    finalize(1);
    process.exit(1);
  },
  warn: (s: string, extra?: Partial<TimelineEntry>) => {
    console.warn(`\x1b[33m!\x1b[0m ${s}`);
    record({ phase: "assert", label: s, status: "warn", ...extra });
  },
  info: (s: string, extra?: Partial<TimelineEntry>) => {
    console.log(`\x1b[36m▸\x1b[0m ${s}`);
    record({ phase: "event", label: s, status: "info", ...extra });
  },
  head: (s: string) => console.log(`\n\x1b[1m${s}\x1b[0m`),
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function liveMode(): Promise<void> {
  C.head(`E2E live mode → ${process.env.CROO_WS_URL}`);
  const need = ["CROO_API_URL", "CROO_WS_URL", "CROO_SDK_KEY"];
  for (const v of need) if (!process.env[v]) C.fail(`Missing env: ${v}`);

  let sdk: typeof import("@croo-network/sdk");
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sdk = (await import("@croo-network/sdk")) as typeof import("@croo-network/sdk");
  } catch {
    C.fail("Live mode requires the real @croo-network/sdk. Run: bun add @croo-network/sdk");
  }

  const client = new sdk!.AgentClient(
    {
      baseURL: process.env.CROO_API_URL!,
      wsURL: process.env.CROO_WS_URL!,
      logger: console,
    },
    process.env.CROO_SDK_KEY!,
  );

  C.info("connecting WebSocket…");
  const stream = await client.connectWebSocket();
  C.ok("connected");

  const observed = new Set<string>();
  for (const ev of Object.values(sdk!.EventType)) {
    stream.on(ev, (e: unknown) => {
      observed.add(String(ev));
      C.info(`event ${String(ev)} → ${JSON.stringify(e).slice(0, 160)}`);
    });
  }

  C.info(`listening ${TIMEOUT}ms — trigger a negotiation against your Service…`);
  await sleep(TIMEOUT);

  C.head("observed events");
  if (observed.size === 0) C.warn("no events received — verify SDK key, Service id, and that a buyer agent paid the order");
  else for (const e of observed) C.ok(e);

  process.exit(0);
}

async function mockMode(): Promise<void> {
  C.head(`E2E mock mode → ${PROVIDER_PATH}`);

  process.env.CROO_API_URL ||= "https://mock.croo.local";
  process.env.CROO_WS_URL ||= "wss://mock.croo.local/ws";
  process.env.CROO_SDK_KEY ||= "croo_sk_mock_e2e_test_key";

  // Load the provider (it runs top-level code: constructs AgentClient,
  // opens the WS stream, registers handlers).
  try {
    await import(PROVIDER_PATH);
  } catch (e) {
    C.fail(`Provider failed to load: ${(e as Error).message}`);
  }
  await sleep(50);

  // --- Assertions: boot ---
  C.head("boot");
  const ctor = __harness.calls.find((c) => c.method === "AgentClient");
  if (!ctor) C.fail("Provider did not construct new AgentClient(config, sdkKey)");
  else {
    const [config, key] = ctor.args as [{ baseURL: string; wsURL: string }, string];
    if (!config?.baseURL?.startsWith("https://")) C.fail("AgentClient baseURL not set from CROO_API_URL");
    if (!config?.wsURL?.startsWith("wss://")) C.fail("AgentClient wsURL not set from CROO_WS_URL");
    if (!key) C.fail("AgentClient sdkKey not set from CROO_SDK_KEY");
    C.ok(`AgentClient(baseURL=${config.baseURL}, wsURL=${config.wsURL})`);
  }
  if (!__harness.calls.some((c) => c.method === "connectWebSocket"))
    C.fail("Provider did not call client.connectWebSocket()");
  C.ok("connectWebSocket()");

  // --- Assertions: subscriptions ---
  C.head("subscriptions");
  if (!__harness.subscriptions.has(EventType.NegotiationCreated))
    C.fail("No handler for EventType.NegotiationCreated");
  C.ok(`EventType.${EventType.NegotiationCreated}`);
  if (!__harness.subscriptions.has(EventType.OrderPaid))
    C.fail("No handler for EventType.OrderPaid");
  C.ok(`EventType.${EventType.OrderPaid}`);

  // --- Drive lifecycle ---
  C.head("lifecycle");
  const negotiationId = "neg_e2e_001";
  const orderId = "order_e2e_001";

  __harness.emit("__emit", {
    event: EventType.NegotiationCreated,
    payload: {
      negotiation_id: negotiationId,
      service_id: "svc_test",
      requester: "did:croo:test-buyer",
    },
  });
  await sleep(150);
  const accept = __harness.calls.find(
    (c) => c.method === "acceptNegotiation" && c.args[0] === negotiationId,
  );
  if (!accept) C.fail("Provider did not call acceptNegotiation(negotiation_id) after NegotiationCreated");
  C.ok(`NegotiationCreated → acceptNegotiation("${negotiationId}")`);

  __harness.emit("__emit", {
    event: EventType.OrderCreated,
    payload: { order_id: orderId, negotiation_id: negotiationId },
  });
  await sleep(50);
  C.ok("OrderCreated (no provider action required)");

  __harness.emit("__emit", {
    event: EventType.OrderPaid,
    payload: { order_id: orderId, amount: "0.05", currency: "USDC" },
  });
  // give the provider time to run async work + deliverOrder
  await sleep(600);

  const delivery = __harness.calls.find(
    (c) => c.method === "deliverOrder" && c.args[0] === orderId,
  );
  if (!delivery) C.fail("Provider did not call deliverOrder(order_id, …) after OrderPaid");
  const req = delivery.args[1] as { type: string; content: unknown };
  if (!req?.type) C.fail("deliverOrder called without DeliverableType");
  if (req.type !== EXPECT_TYPE)
    C.warn(`DeliverableType is "${req.type}" but --expect-type=${EXPECT_TYPE}`);
  if (req.content == null || (typeof req.content === "string" && !req.content.length))
    C.fail("deliverOrder content is empty");
  C.ok(`OrderPaid → deliverOrder (type=${req.type}, content=${String(req.content).slice(0, 60)}…)`);

  // --- Idempotency ---
  C.head("idempotency");
  const before = __harness.calls.filter((c) => c.method === "deliverOrder").length;
  __harness.emit("__emit", {
    event: EventType.OrderPaid,
    payload: { order_id: orderId, amount: "0.05", currency: "USDC" },
  });
  await sleep(400);
  const after = __harness.calls.filter((c) => c.method === "deliverOrder").length;
  if (after > before)
    C.warn(`duplicate OrderPaid re-triggered deliverOrder (${before} → ${after}). Guard with a Set or getDelivery().`);
  else C.ok("duplicate OrderPaid suppressed");

  // --- Completion ---
  C.head("completion");
  __harness.emit("__emit", {
    event: EventType.OrderCompleted,
    payload: { order_id: orderId, settled_at: new Date().toISOString() },
  });
  await sleep(50);
  C.ok("OrderCompleted dispatched");

  // --- Trace ---
  C.head("call trace");
  for (const c of __harness.calls) {
    const a = JSON.stringify(c.args);
    console.log(`  ${c.method}(${a.length > 140 ? a.slice(0, 140) + "…" : a})`);
  }

  console.log(`\n\x1b[1;32m✓ E2E flow validated against @croo-network/sdk surface\x1b[0m`);
  process.exit(0);
}

if (MODE === "live") await liveMode();
else await mockMode();