import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/playground")({
  head: () => ({
    meta: [
      { title: "ShipKit Console — Scaffold, audit, and list CAP agents" },
      { name: "description", content: "AI-powered console that scaffolds, audits, and lists paid CAP agents for the CROO Agent Store." },
      { property: "og:title", content: "ShipKit Console" },
      { property: "og:description", content: "Scaffold, audit, and list CAP agents from one prompt." },
    ],
  }),
  component: Playground,
});

const PRESETS = [
  {
    label: "Scaffold a research agent",
    prompt:
      "Scaffold a Node.js provider for a paid Research & Intelligence Service on CROO. Price: 0.05 USDC per call. Returns text + sources. Show me provider.ts using @croo-network/sdk (AgentClient, connectWebSocket, NegotiationCreated → acceptNegotiation, OrderPaid → deliverOrder with DeliverableType.Text), a .env.example, and a requester.ts snippet that calls negotiateOrder then payOrder.",
  },
  {
    label: "Audit my agent",
    prompt:
      "I have a Node.js provider for a CROO Service that calls an LLM and returns text. Audit it against the real @croo-network/sdk: AgentClient via env, connectWebSocket loop, OrderPaid → deliverOrder, DeliverableType matches the Service's configured output, typed error handling (APIError, isInsufficientBalance, isInvalidStatus), idempotency on duplicate OrderPaid events, and SLA-aware delivery. Give me a concrete checklist with fixes.",
  },
  {
    label: "Generate Agent Store listing",
    prompt:
      "Generate Agent Store Configure wizard copy for LiquidWatch — a DeFi-monitoring Service on CROO that watches Uniswap v3 pools and emits risk alerts at 0.01 USDC per call. Output exactly the wizard fields: Service Name, Price, Description, SLA (Hh Mm), Deliverable (Text or Schema), Requirements (Text/Schema/none), and 1–5 Skill Tags. Then a 4-question buyer FAQ.",
  },
  {
    label: "Suggest A2A composability",
    prompt:
      "I built a citation-verification Service on CROO. Suggest 5 other Services that could hire it as a dependency via negotiateOrder + payOrder. For each one, show a 4-line requester.ts snippet using @croo-network/sdk.",
  },
];

function Playground() {
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const { messages, sendMessage, status, error } = useChat({
    id: "shipkit-console",
    transport,
  });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const isLoading = status === "submitted" || status === "streaming";

  const submit = (text: string) => {
    if (!text.trim() || isLoading) return;
    void sendMessage({ text: text.trim() });
    setInput("");
  };

  return (
    <main className="mx-auto max-w-6xl px-6 pt-10 pb-16">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-mono-eyebrow">/console</p>
          <h1 className="mt-2 font-mono text-3xl font-bold md:text-4xl">ShipKit Console</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            An AI dev agent that scaffolds, audits, and lists paid CAP agents. Ask for code,
            manifests, listing copy, or composability ideas.
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <span className="live-dot" />
          <span>model: <span className="text-signal">gemini-3-flash</span></span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Presets */}
        <aside className="space-y-2">
          <p className="font-mono text-xs text-muted-foreground">presets</p>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => submit(p.prompt)}
              disabled={isLoading}
              className="group w-full border border-border bg-surface/60 p-3 text-left transition hover:border-signal/60 hover:bg-surface-2 disabled:opacity-50"
            >
              <span className="font-mono text-xs text-signal">$ {p.label.toLowerCase().replace(/\s+/g, "-")}</span>
              <p className="mt-1 text-sm text-foreground">{p.label}</p>
            </button>
          ))}
          <p className="pt-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
            ShipKit runs on Lovable AI. The CAP SDK calls shown are illustrative — wire them to{" "}
            <a href="https://docs.croo.network" target="_blank" rel="noreferrer" className="text-signal underline-offset-4 hover:underline">docs.croo.network</a> for production.
          </p>
        </aside>

        {/* Chat */}
        <div className="panel flex h-[640px] flex-col rounded-md">
          <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-signal/70" />
            <span className="ml-3">shipkit — interactive console</span>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto p-5">
            {messages.length === 0 && (
              <div className="space-y-3 font-mono text-sm text-muted-foreground">
                <p><span className="text-signal">shipkit</span>@cap:~$ ready.</p>
                <p>Pick a preset on the left, or ask me to scaffold, audit, or list a CAP agent.</p>
              </div>
            )}
            {messages.map((m) => {
              const text = m.parts
                .map((part) => (part.type === "text" ? part.text : ""))
                .join("");
              const isUser = m.role === "user";
              return (
                <div key={m.id} className="flex flex-col gap-1.5">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {isUser ? <span className="text-earn">you@console</span> : <span className="text-signal">shipkit@cap</span>}
                    <span className="text-muted-foreground">:~$</span>
                  </span>
                  <div
                    className={
                      "whitespace-pre-wrap rounded-sm border px-4 py-3 font-mono text-[13px] leading-relaxed " +
                      (isUser
                        ? "border-earn/40 bg-earn/5 text-foreground"
                        : "border-border bg-background/50 text-foreground/90")
                    }
                  >
                    {text || (isLoading && !isUser ? "▍" : "")}
                  </div>
                </div>
              );
            })}
            {error && (
              <div className="border border-destructive/50 bg-destructive/10 px-4 py-3 font-mono text-xs text-destructive">
                error: {error.message}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
            className="flex items-center gap-2 border-t border-border bg-surface-2/40 p-3"
          >
            <span className="font-mono text-sm text-signal">$</span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="scaffold a paid agent that..."
              className="flex-1 bg-transparent font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground"
              disabled={isLoading}
              autoFocus
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="border border-signal bg-signal/10 px-4 py-2 font-mono text-xs text-signal transition hover:bg-signal hover:text-primary-foreground disabled:opacity-40 disabled:hover:bg-signal/10 disabled:hover:text-signal"
            >
              {isLoading ? "running…" : "run ↵"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}