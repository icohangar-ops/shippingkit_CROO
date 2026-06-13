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

function emitEvent(event: string, payload: unknown) {
  record({ phase: "event", label: `emit ${event}`, status: "info", actual: payload });
  __harness.emit("__emit", { event, payload });
}

function attachHarnessListeners() {
  __harness.on("subscribed", (ev: string) => {
    record({ phase: "subscribe", label: `stream.on(${ev})`, status: "info" });
  });
  __harness.on("call", (c: { method: string; args: unknown[] }) => {
    record({
      phase: "call",
      label: `${c.method}(${JSON.stringify(c.args).slice(0, 140)})`,
      status: "info",
      actual: c.args,
    });
  });
}

function finalize(exitCode: number) {
  if (!WRITE_REPORT) return;
  try {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  } catch {}
  const summary = {
    name: REPORT_NAME,
    provider: PROVIDER_PATH,
    mode: MODE,
    expectType: EXPECT_TYPE,
    startedAt: new Date(t0).toISOString(),
    durationMs: Date.now() - t0,
    exitCode,
    counts: {
      ok: timeline.filter((e) => e.status === "ok").length,
      fail: timeline.filter((e) => e.status === "fail").length,
      warn: timeline.filter((e) => e.status === "warn").length,
      calls: timeline.filter((e) => e.phase === "call").length,
      events: timeline.filter((e) => e.phase === "event").length,
    },
    timeline,
    calls: __harness.calls,
    subscriptions: Array.from(__harness.subscriptions),
  };
  const jsonPath = path.join(REPORT_DIR, `${REPORT_NAME}.json`);
  const htmlPath = path.join(REPORT_DIR, `${REPORT_NAME}.html`);
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
  fs.writeFileSync(htmlPath, renderHTML(summary));
  console.log(`\n\x1b[36m▸\x1b[0m report: ${htmlPath}`);
  console.log(`\x1b[36m▸\x1b[0m report: ${jsonPath}`);
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function renderHTML(s: ReturnType<() => any>): string {
  const failing = (s.timeline as TimelineEntry[]).filter((e) => e.status === "fail" || e.status === "warn");
  const rows = (s.timeline as TimelineEntry[]).map((e, i) => {
    const color = { ok: "#16a34a", fail: "#dc2626", warn: "#d97706", info: "#0891b2" }[e.status];
    const icon = { ok: "✓", fail: "✗", warn: "!", info: "▸" }[e.status];
    const diffBlock = e.diff ? `<pre class="diff">${esc(e.diff)}</pre>` : "";
    const expBlock = e.expected !== undefined ? `<details><summary>expected</summary><pre>${esc(JSON.stringify(e.expected, null, 2))}</pre></details>` : "";
    const actBlock = e.actual !== undefined ? `<details><summary>actual</summary><pre>${esc(JSON.stringify(e.actual, null, 2))}</pre></details>` : "";
    return `<tr class="row ${e.status}" data-status="${e.status}">
      <td class="ts">+${e.ts}ms</td>
      <td class="phase">${e.phase}</td>
      <td class="status" style="color:${color}">${icon}</td>
      <td class="label"><div>${esc(e.label)}</div>${expBlock}${actBlock}${diffBlock}</td>
    </tr>`;
  }).join("\n");

  const overall = s.exitCode === 0 ? (s.counts.warn ? "PASS (with warnings)" : "PASS") : "FAIL";
  const overallColor = s.exitCode === 0 ? (s.counts.warn ? "#d97706" : "#16a34a") : "#dc2626";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<title>ShipKit E2E — ${esc(s.name)}</title>
<style>
  :root { color-scheme: dark; }
  body { font: 14px/1.5 ui-sans-serif, system-ui, sans-serif; background:#0b0f17; color:#e5e7eb; margin:0; padding:24px; }
  h1 { font-size:20px; margin:0 0 4px; }
  .meta { color:#9ca3af; font-size:12px; margin-bottom:16px; }
  .pill { display:inline-block; padding:2px 10px; border-radius:999px; font-weight:600; color:#fff; }
  .stats { display:flex; gap:16px; margin:16px 0; flex-wrap:wrap; }
  .stat { background:#111827; padding:10px 14px; border-radius:8px; min-width:90px; }
  .stat b { font-size:18px; display:block; }
  table { width:100%; border-collapse:collapse; margin-top:8px; }
  td { padding:8px 10px; border-bottom:1px solid #1f2937; vertical-align:top; }
  td.ts { color:#6b7280; font-variant-numeric:tabular-nums; width:70px; }
  td.phase { color:#9ca3af; width:80px; font-size:12px; text-transform:uppercase; letter-spacing:.05em; }
  td.status { width:24px; font-weight:700; text-align:center; }
  pre { background:#0f172a; border:1px solid #1f2937; padding:8px; border-radius:6px; overflow:auto; margin:6px 0 0; font-size:12px; }
  pre.diff { background:#1c0f0f; border-color:#451a1a; color:#fecaca; }
  details > summary { cursor:pointer; color:#60a5fa; font-size:12px; margin-top:6px; }
  .toolbar { display:flex; gap:8px; margin:12px 0; flex-wrap:wrap; }
  button { background:#1f2937; color:#e5e7eb; border:1px solid #374151; padding:6px 12px; border-radius:6px; cursor:pointer; font:inherit; }
  button:hover { background:#374151; }
  .row.hidden { display:none; }
</style></head>
<body>
  <h1>ShipKit E2E Report <span class="pill" style="background:${overallColor}">${overall}</span></h1>
  <div class="meta">
    ${esc(s.name)} · provider <code>${esc(s.provider)}</code> · mode <b>${esc(s.mode)}</b> · ${s.durationMs}ms · ${esc(s.startedAt)}
  </div>
  <div class="stats">
    <div class="stat"><b style="color:#16a34a">${s.counts.ok}</b>passed</div>
    <div class="stat"><b style="color:#dc2626">${s.counts.fail}</b>failed</div>
    <div class="stat"><b style="color:#d97706">${s.counts.warn}</b>warnings</div>
    <div class="stat"><b>${s.counts.calls}</b>SDK calls</div>
    <div class="stat"><b>${s.counts.events}</b>events</div>
  </div>
  <div class="toolbar">
    <button onclick="filter('all')">All</button>
    <button onclick="filter('fail')">Failing only</button>
    <button onclick="filter('warn')">Warnings</button>
    <button onclick="exportFailing()">⬇ Export failing traces (JSON)</button>
    <button onclick="copyFailing()">📋 Copy failing traces</button>
  </div>
  <table><tbody>${rows}</tbody></table>
  <script id="failing" type="application/json">${esc(JSON.stringify(failing, null, 2))}</script>
  <script>
    function filter(mode) {
      document.querySelectorAll('.row').forEach(r => {
        const st = r.dataset.status;
        const show = mode==='all' || st===mode || (mode==='fail' && st==='fail');
        r.classList.toggle('hidden', !show);
      });
    }
    function failingPayload() {
      return document.getElementById('failing').textContent;
    }
    function exportFailing() {
      const blob = new Blob([failingPayload()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = ${JSON.stringify(`${s.name}-failing.json`)};
      a.click();
    }
    async function copyFailing() {
      await navigator.clipboard.writeText(failingPayload());
      alert('Failing traces copied to clipboard');
    }
  </script>
</body></html>`;
}

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

  finalize(0);
  process.exit(0);
}

async function mockMode(): Promise<void> {
  C.head(`E2E mock mode → ${PROVIDER_PATH}`);

  process.env.CROO_API_URL ||= "https://mock.croo.local";
  process.env.CROO_WS_URL ||= "wss://mock.croo.local/ws";
  process.env.CROO_SDK_KEY ||= "croo_sk_mock_e2e_test_key";
  attachHarnessListeners();

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
    if (!config?.baseURL?.startsWith("https://"))
      C.fail("AgentClient baseURL not set from CROO_API_URL", {
        expected: "https://…", actual: config?.baseURL,
      });
    if (!config?.wsURL?.startsWith("wss://"))
      C.fail("AgentClient wsURL not set from CROO_WS_URL", {
        expected: "wss://…", actual: config?.wsURL,
      });
    if (!key) C.fail("AgentClient sdkKey not set from CROO_SDK_KEY");
    C.ok(`AgentClient(baseURL=${config.baseURL}, wsURL=${config.wsURL})`, {
      actual: { baseURL: config.baseURL, wsURL: config.wsURL, sdkKey: key.slice(0, 12) + "…" },
    });
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

  emitEvent(EventType.NegotiationCreated, {
    negotiation_id: negotiationId,
    service_id: "svc_test",
    requester: "did:croo:test-buyer",
  });
  await sleep(150);
  const accept = __harness.calls.find(
    (c) => c.method === "acceptNegotiation" && c.args[0] === negotiationId,
  );
  if (!accept)
    C.fail("Provider did not call acceptNegotiation(negotiation_id) after NegotiationCreated", {
      expected: { method: "acceptNegotiation", args: [negotiationId] },
      actual: __harness.calls.map((c) => c.method),
    });
  C.ok(`NegotiationCreated → acceptNegotiation("${negotiationId}")`, {
    expected: { method: "acceptNegotiation", args: [negotiationId] },
    actual: { method: "acceptNegotiation", args: accept!.args },
    diff: diffJSON([negotiationId], accept!.args),
  });

  emitEvent(EventType.OrderCreated, { order_id: orderId, negotiation_id: negotiationId });
  await sleep(50);
  C.ok("OrderCreated (no provider action required)");

  emitEvent(EventType.OrderPaid, { order_id: orderId, amount: "0.05", currency: "USDC" });
  // give the provider time to run async work + deliverOrder
  await sleep(600);

  const delivery = __harness.calls.find(
    (c) => c.method === "deliverOrder" && c.args[0] === orderId,
  );
  if (!delivery)
    C.fail("Provider did not call deliverOrder(order_id, …) after OrderPaid", {
      expected: { method: "deliverOrder", args: [orderId, { type: EXPECT_TYPE, content: "<any>" }] },
      actual: __harness.calls.map((c) => c.method),
    });
  const req = delivery.args[1] as { type: string; content: unknown };
  if (!req?.type) C.fail("deliverOrder called without DeliverableType");
  if (req.type !== EXPECT_TYPE)
    C.warn(`DeliverableType is "${req.type}" but --expect-type=${EXPECT_TYPE}`, {
      expected: { type: EXPECT_TYPE }, actual: { type: req.type },
      diff: diffJSON({ type: EXPECT_TYPE }, { type: req.type }),
    });
  if (req.content == null || (typeof req.content === "string" && !req.content.length))
    C.fail("deliverOrder content is empty");
  C.ok(`OrderPaid → deliverOrder (type=${req.type}, content=${String(req.content).slice(0, 60)}…)`, {
    expected: { method: "deliverOrder", args: [orderId, { type: EXPECT_TYPE, content: "<any>" }] },
    actual: { method: "deliverOrder", args: delivery.args },
  });

  // --- Idempotency ---
  C.head("idempotency");
  const before = __harness.calls.filter((c) => c.method === "deliverOrder").length;
  emitEvent(EventType.OrderPaid, { order_id: orderId, amount: "0.05", currency: "USDC" });
  await sleep(400);
  const after = __harness.calls.filter((c) => c.method === "deliverOrder").length;
  if (after > before)
    C.fail(
      `duplicate OrderPaid re-triggered deliverOrder (${before} → ${after}). Guard with a Set or getDelivery().`,
      { expected: { deliverOrderCalls: before }, actual: { deliverOrderCalls: after } },
    );
  else C.ok("duplicate OrderPaid suppressed", {
    expected: { deliverOrderCalls: before }, actual: { deliverOrderCalls: after },
  });

  // --- Completion ---
  C.head("completion");
  emitEvent(EventType.OrderCompleted, { order_id: orderId, settled_at: new Date().toISOString() });
  await sleep(50);
  C.ok("OrderCompleted dispatched");

  // --- Trace ---
  C.head("call trace");
  for (const c of __harness.calls) {
    const a = JSON.stringify(c.args);
    console.log(`  ${c.method}(${a.length > 140 ? a.slice(0, 140) + "…" : a})`);
  }

  console.log(`\n\x1b[1;32m✓ E2E flow validated against @croo-network/sdk surface\x1b[0m`);
  finalize(0);
  process.exit(0);
}

if (MODE === "live") await liveMode();
else await mockMode();