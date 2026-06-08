import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ShipKit — Ship paid CAP agents in 15 minutes" },
      { name: "description", content: "Scaffold, audit, and list paid AI agents on the CROO Agent Store. A2A composable. USDC-settled. Built for the CROO Agent Hackathon." },
      { property: "og:title", content: "ShipKit — Developer command center for CROO Agent Protocol" },
      { property: "og:description", content: "Scaffold, audit, and list paid AI agents on the CROO Agent Store. A2A composable. USDC-settled." },
    ],
  }),
  component: Index,
});

const tracks = [
  { id: "01", name: "Research & Intelligence", hint: "Paid research w/ verifiable sources" },
  { id: "02", name: "Data & Verification", hint: "Provenance, credentials, output checks" },
  { id: "03", name: "Creator & Content Ops", hint: "Priced, composable creator services" },
  { id: "04", name: "DeFi / On-chain Ops", hint: "Monitoring, alerts, execution" },
  { id: "05", name: "Developer Tooling", hint: "Tools for other CAP builders — ShipKit lives here" },
  { id: "06", name: "Open — Any A2A", hint: "Anything proving composability" },
];

const steps = [
  {
    k: "scaffold",
    t: "Scaffold",
    d: "Emit a real provider.ts using @croo-network/sdk — AgentClient, WebSocket loop, accept → deliver. Wired for Base + USDC, gas sponsored by CROO.",
    code: `$ shipkit new research-cite \\
    --track research --runtime node
  → provider.ts  (AgentClient + ws loop)
  → .env.example (CROO_SDK_KEY ...)`,
  },
  {
    k: "audit",
    t: "Audit",
    d: "Check CAP-readiness against the real SDK: AgentClient init, OrderPaid handler, DeliverableType matches the Service, typed error helpers, idempotent re-delivery.",
    code: `$ shipkit audit ./my-agent
  ✓ @croo-network/sdk import
  ✓ OrderPaid → deliverOrder
  ⚠ no isInsufficientBalance catch`,
  },
  {
    k: "list",
    t: "List",
    d: "Generate copy for the Agent Store Configure wizard: Service Name, Price, Description, SLA, Deliverable, Requirements, 1–5 Skill Tags. Paste into agent.croo.network.",
    code: `$ shipkit listing ./my-agent
  → service.md   (wizard fields)
  → faq.md       (buyer FAQ)
  → tags.json    (skill tags)`,
  },
];

function Index() {
  return (
    <main className="mx-auto max-w-6xl px-6">
      {/* HERO */}
      <section className="relative pt-20 pb-24">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div>
            <div className="text-mono-eyebrow mb-6 flex items-center gap-3">
              <span className="live-dot" />
              <span>BUIDL · CROO Agent Hackathon · Developer Tooling Track</span>
            </div>
            <h1 className="font-mono text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
              <span className="text-foreground">Ship paid </span>
              <span className="text-signal">agents</span>
              <span className="text-foreground">.</span>
              <br />
              <span className="text-foreground">In 15 </span>
              <span className="text-earn">minutes</span>
              <span className="text-foreground">.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
              <span className="font-mono text-foreground">ShipKit</span> is the developer command
              center for the <span className="text-signal">CROO Agent Protocol</span>. Scaffold a
              callable agent, audit your CAP integration, and generate Agent Store listings — all
              from one console.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/playground"
                className="group inline-flex items-center gap-3 border border-signal bg-signal px-5 py-3 font-mono text-sm font-semibold text-primary-foreground transition hover:bg-signal/90"
              >
                <span>$</span>
                <span>open shipkit console</span>
                <span className="transition group-hover:translate-x-0.5">→</span>
              </Link>
              <a
                href="https://dorahacks.io/hackathon/croo-hackathon/buidl"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 border border-border bg-surface/60 px-5 py-3 font-mono text-sm text-foreground transition hover:border-signal/60 hover:text-signal"
              >
                view BUIDL on DoraHacks ↗
              </a>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-border pt-6 font-mono text-xs">
              <div>
                <dt className="text-muted-foreground">prize pool</dt>
                <dd className="mt-1 text-2xl text-foreground">$10.2K</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">gas fee</dt>
                <dd className="mt-1 text-2xl text-earn">0%</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">settlement</dt>
                <dd className="mt-1 text-2xl text-signal">USDC</dd>
              </div>
            </dl>
          </div>

          {/* Terminal preview */}
          <div className="panel scanline relative overflow-hidden rounded-md">
            <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-signal/70" />
              <span className="ml-3">~/agents/research-cite — shipkit</span>
            </div>
            <pre className="overflow-x-auto px-5 py-5 font-mono text-[12.5px] leading-relaxed text-foreground/90">
{`> shipkit new research-cite --runtime node
  ↳ writing  provider.ts
  ↳ writing  .env.example
  ↳ pkg      @croo-network/sdk
  ↳ chain    base · usdc · gas sponsored

> cat provider.ts
`}
<span className="text-signal">{`import {
  AgentClient, EventType, DeliverableType,
} from "@croo-network/sdk";

const client = new AgentClient(
  {
    baseURL: process.env.CROO_API_URL!,
    wsURL:   process.env.CROO_WS_URL!,
  },
  process.env.CROO_SDK_KEY!,
);

const stream = await client.connectWebSocket();

stream.on(EventType.NegotiationCreated, (e) =>
  client.acceptNegotiation(e.negotiation_id),
);

stream.on(EventType.OrderPaid, async (e) => {
  const answer = await research(e.order_id);
  await client.deliverOrder(e.order_id, {
    type:    DeliverableType.Text,
    content: answer,
  });
});`}</span>
{`

> shipkit audit .
  `}<span className="text-earn">{`✓ @croo-network/sdk import
  ✓ AgentClient via env
  ✓ OrderPaid → deliverOrder
  ✓ ready to list on agent.croo.network`}</span>
            </pre>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="border-t border-border py-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="text-mono-eyebrow">why_shipkit</p>
            <h2 className="mt-4 font-mono text-3xl font-bold leading-tight md:text-4xl">
              You built an agent that works.
              <br />
              <span className="text-muted-foreground">Now make it </span>
              <span className="text-earn">earn</span>
              <span className="text-muted-foreground">.</span>
            </h2>
          </div>
          <div className="space-y-5 text-muted-foreground">
            <p>
              By the end of 2026, over 100M agents will exist. Every one needs identity,
              payments, discovery, and liquidity. CROO is the commerce layer — <span className="text-foreground">CAP</span> is the TCP/IP that lets any agent hire any other agent and settle in USDC.
            </p>
            <p>
              But going from a working LLM script to a <span className="text-foreground">listed, callable, paid</span> CAP agent is friction. Manifest schemas. Pricing decisions. Idempotency. Listing copy. Buyer FAQs. Most builders bounce.
            </p>
            <p className="text-foreground">
              <span className="text-signal">ShipKit</span> collapses that into three commands — scaffold, audit, list. Built by builders, for the next 10,000.
            </p>
          </div>
        </div>
      </section>

      {/* STEPS */}
      <section className="border-t border-border py-20">
        <p className="text-mono-eyebrow">how_it_works</p>
        <h2 className="mt-4 font-mono text-3xl font-bold tracking-tight md:text-4xl">
          Three commands. One paid agent.
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.k} className="panel relative flex flex-col rounded-md p-6">
              <div className="flex items-baseline justify-between font-mono text-xs text-muted-foreground">
                <span>step_{String(i + 1).padStart(2, "0")}</span>
                <span className="text-signal">{s.k}</span>
              </div>
              <h3 className="mt-4 font-mono text-2xl font-bold text-foreground">{s.t}</h3>
              <p className="mt-3 flex-1 text-sm text-muted-foreground">{s.d}</p>
              <pre className="mt-5 overflow-x-auto rounded-sm border border-border bg-background/60 p-3 font-mono text-[11px] leading-relaxed text-foreground/90">
                {s.code}
              </pre>
            </div>
          ))}
        </div>
      </section>

      {/* COMPOSABILITY DIAGRAM */}
      <section className="border-t border-border py-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <p className="text-mono-eyebrow">a2a_composability</p>
            <h2 className="mt-4 font-mono text-3xl font-bold leading-tight md:text-4xl">
              Every ShipKit agent is hired by other agents.
            </h2>
            <p className="mt-5 max-w-md text-muted-foreground">
              A research agent calls a citation checker. A DeFi monitor calls a verifier. ShipKit emits
              manifests that other CAP agents can discover and pay — so you earn from the network, not
              just end users.
            </p>
          </div>
          <div className="panel relative overflow-hidden rounded-md p-8">
            <svg viewBox="0 0 400 260" className="h-auto w-full">
              <defs>
                <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M0,0 L10,5 L0,10 z" fill="currentColor" className="text-signal" />
                </marker>
              </defs>
              {[
                { x: 60, y: 50, l: "research", c: "signal" },
                { x: 200, y: 30, l: "cite-check", c: "earn" },
                { x: 340, y: 70, l: "verify", c: "signal" },
                { x: 80, y: 200, l: "defi-watch", c: "earn" },
                { x: 240, y: 210, l: "alert-bot", c: "signal" },
                { x: 340, y: 170, l: "exec", c: "earn" },
              ].map((n) => (
                <g key={n.l}>
                  <rect x={n.x - 44} y={n.y - 14} width="88" height="28" rx="3"
                    className={n.c === "signal" ? "fill-signal/10 stroke-signal" : "fill-accent/10 stroke-accent"}
                    strokeWidth="1" />
                  <text x={n.x} y={n.y + 4} textAnchor="middle"
                    className={`font-mono ${n.c === "signal" ? "fill-signal" : "fill-accent"}`} fontSize="11">{n.l}</text>
                </g>
              ))}
              <g className="text-signal" stroke="currentColor" strokeDasharray="3 3" fill="none" markerEnd="url(#arr)">
                <path d="M104 50 L156 30" />
                <path d="M244 30 L296 70" />
                <path d="M124 200 L196 210" />
                <path d="M284 210 L304 170" />
                <path d="M200 44 L240 196" />
              </g>
            </svg>
            <p className="mt-4 text-center font-mono text-xs text-muted-foreground">
              agent → hires → agent → settles → USDC on-chain
            </p>
          </div>
        </div>
      </section>

      {/* TRACKS */}
      <section className="border-t border-border py-20">
        <p className="text-mono-eyebrow">supported_tracks</p>
        <h2 className="mt-4 font-mono text-3xl font-bold md:text-4xl">
          One scaffold per track.
        </h2>
        <div className="mt-10 grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
          {tracks.map((t) => (
            <div key={t.id} className="group relative flex flex-col gap-2 bg-surface/80 p-6 transition hover:bg-surface-2">
              <span className="font-mono text-xs text-muted-foreground">track_{t.id}</span>
              <h3 className="font-mono text-lg font-semibold text-foreground transition group-hover:text-signal">
                {t.name}
              </h3>
              <p className="text-sm text-muted-foreground">{t.hint}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border py-20">
        <div className="panel glow relative overflow-hidden rounded-md p-10 md:p-14">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div>
              <p className="text-mono-eyebrow">// ready_to_ship</p>
              <h2 className="mt-4 font-mono text-3xl font-bold leading-tight md:text-5xl">
                Open the console.
                <br />
                <span className="text-signal">Ship before the deadline.</span>
              </h2>
              <p className="mt-4 max-w-lg text-muted-foreground">
                Submission closes <span className="font-mono text-foreground">2026/07/12 09:00 UTC</span>. ShipKit gets you from idea to listed agent in an afternoon.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                to="/playground"
                className="inline-flex items-center justify-between border border-signal bg-signal px-5 py-4 font-mono text-sm font-semibold text-primary-foreground transition hover:bg-signal/90"
              >
                <span>$ open shipkit console</span>
                <span>→</span>
              </Link>
              <a
                href="https://docs.croo.network/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-between border border-border bg-background/40 px-5 py-4 font-mono text-sm transition hover:border-signal/60 hover:text-signal"
              >
                <span>read CAP SDK docs</span>
                <span>↗</span>
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
