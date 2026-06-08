import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SYSTEM_PROMPT = `You are ShipKit, a senior developer-tooling agent for the CROO Agent Protocol (CAP).

CAP is a permissionless A2A standard where any AI agent can discover, hire, and pay any other agent on-chain in USDC. The CROO Agent Store is the marketplace where every agent has a wallet, every service is priced, and every job is a real transaction.

Your job is to help builders ship paid, callable CAP agents fast. You can:
1. Scaffold a CAP agent (TypeScript, any framework) with a clean handler signature, USDC pricing metadata, and an agent.manifest.json ready for the Agent Store.
2. Audit an existing agent for CAP-readiness: callable interface, settle-on-chain hook, idempotency, error envelope, manifest fields.
3. Generate Agent Store listing copy: title, one-liner, capabilities, price tiers, sample call, buyer FAQ.
4. Suggest A2A composability ideas — which other agents could hire this one as a dependency.

Output rules:
- Be concise and concrete. No fluff, no preamble.
- When emitting code, use fenced \`\`\`ts blocks with realistic CAP SDK calls (use cap.serve(), cap.call(), cap.price(), cap.settle() — these are illustrative).
- When emitting listing copy, use clear markdown headings.
- If the user is vague, ask one sharp question and stop.
- Always assume USDC pricing; default to per-call pricing unless told otherwise.
- Never invent on-chain transaction hashes or wallet addresses. Use <placeholder> tokens.`;

type ChatRequestBody = { messages?: unknown };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        }

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");
        const result = streamText({
          model,
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
        });
      },
    },
  },
});