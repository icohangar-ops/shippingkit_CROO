import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { validateShipKitOutput } from "@/lib/api/validate.functions";

export const Route = createFileRoute("/validate")({
  head: () => ({
    meta: [
      { title: "ShipKit Validate — CAP SDK conformance harness" },
      {
        name: "description",
        content:
          "Paste a provider or requester file and validate it against the real @croo-network/sdk AgentClient surface and WebSocket event flow before listing.",
      },
    ],
  }),
  component: ValidatePage,
});

const SAMPLE_PROVIDER = `import { AgentClient, EventType, DeliverableType, isInsufficientBalance } from '@croo-network/sdk';

const client = new AgentClient(
  { baseURL: process.env.CROO_API_URL!, wsURL: process.env.CROO_WS_URL! },
  process.env.CROO_SDK_KEY!,
);

const seen = new Set<string>();
const stream = await client.connectWebSocket();

stream.on(EventType.NegotiationCreated, async (e) => {
  await client.acceptNegotiation(e.negotiation_id);
});

stream.on(EventType.OrderPaid, async (e) => {
  if (seen.has(e.order_id)) return;
  seen.add(e.order_id);
  const content = await runWork(e.order_id);
  await client.deliverOrder(e.order_id, { type: DeliverableType.Text, content });
});

stream.on(EventType.OrderCompleted, (e) => console.log('settled', e.order_id));
`;

function ValidatePage() {
  const run = useServerFn(validateShipKitOutput);
  const [source, setSource] = useState(SAMPLE_PROVIDER);
  const [kind, setKind] = useState<"auto" | "provider" | "requester">("auto");

  const mutation = useMutation({
    mutationFn: (vars: { source: string; kind: typeof kind }) =>
      run({ data: vars }),
  });

  const result = mutation.data;

  return (
    <main className="mx-auto max-w-6xl px-6 pt-10 pb-16">
      <div className="mb-6">
        <p className="text-mono-eyebrow">/validate</p>
        <h1 className="mt-2 font-mono text-3xl font-bold md:text-4xl">SDK Conformance Harness</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Static-checks ShipKit output against the exact <code className="text-signal">@croo-network/sdk</code>{" "}
          surface and simulates the WebSocket lifecycle locally — no API key, no on-chain calls.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="panel rounded-md">
          <div className="flex items-center justify-between border-b border-border bg-surface-2/60 px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
            <span>input.ts</span>
            <div className="flex items-center gap-2">
              <label className="text-muted-foreground">kind:</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as typeof kind)}
                className="border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground"
              >
                <option value="auto">auto</option>
                <option value="provider">provider</option>
                <option value="requester">requester</option>
              </select>
            </div>
          </div>
          <textarea
            value={source}
            onChange={(e) => setSource(e.target.value)}
            spellCheck={false}
            className="h-[520px] w-full resize-none bg-background p-4 font-mono text-[12.5px] leading-relaxed text-foreground outline-none"
          />
          <div className="flex items-center justify-between border-t border-border bg-surface-2/40 p-3">
            <span className="font-mono text-[11px] text-muted-foreground">
              {source.length.toLocaleString()} chars
            </span>
            <button
              onClick={() => mutation.mutate({ source, kind })}
              disabled={mutation.isPending || !source.trim()}
              className="border border-signal bg-signal/10 px-4 py-2 font-mono text-xs text-signal transition hover:bg-signal hover:text-primary-foreground disabled:opacity-40"
            >
              {mutation.isPending ? "validating…" : "run validation ↵"}
            </button>
          </div>
        </section>

        <section className="panel flex h-[600px] flex-col rounded-md">
          <div className="border-b border-border bg-surface-2/60 px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
            report.json
          </div>
          <div className="flex-1 overflow-y-auto p-4 font-mono text-[12.5px]">
            {!result && !mutation.isError && (
              <p className="text-muted-foreground">awaiting run…</p>
            )}
            {mutation.isError && (
              <p className="text-destructive">error: {(mutation.error as Error).message}</p>
            )}
            {result && (
              <div className="space-y-5">
                <header className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground">
                      kind: <span className="text-signal">{result.report.kind}</span>
                    </p>
                    <p className="text-muted-foreground">
                      score:{" "}
                      <span className={result.report.failed === 0 ? "text-earn" : "text-destructive"}>
                        {result.report.score}/100
                      </span>{" "}
                      ({result.report.passed} passed, {result.report.failed} failed)
                    </p>
                  </div>
                </header>

                <div>
                  <p className="mb-2 text-muted-foreground">checks</p>
                  <ul className="space-y-1.5">
                    {result.report.checks.map((c) => (
                      <li key={c.id} className="flex gap-2">
                        <span
                          className={
                            c.passed
                              ? "text-earn"
                              : c.severity === "error"
                                ? "text-destructive"
                                : c.severity === "warn"
                                  ? "text-accent"
                                  : "text-muted-foreground"
                          }
                        >
                          {c.passed ? "✓" : c.severity === "error" ? "✗" : "!"}
                        </span>
                        <div className="flex-1">
                          <p className="text-foreground">{c.label}</p>
                          {c.detail && (
                            <p className="text-[11px] text-muted-foreground">{c.detail}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {result.trace && (
                  <div>
                    <p className="mb-2 text-muted-foreground">lifecycle simulation</p>
                    <ol className="space-y-1.5">
                      {result.trace.steps.map((s) => (
                        <li key={s.step} className="flex gap-2">
                          <span className={s.handled ? "text-earn" : "text-destructive"}>
                            {String(s.step).padStart(2, "0")}
                          </span>
                          <div className="flex-1">
                            <p>
                              <span className="text-signal">{s.event}</span>{" "}
                              <span className="text-foreground">{s.expected}</span>
                            </p>
                            {s.evidence && (
                              <pre className="mt-0.5 whitespace-pre-wrap text-[11px] text-muted-foreground">
                                {s.evidence}
                              </pre>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                    <p className="mt-3 text-[12px] text-muted-foreground">{result.trace.summary}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}