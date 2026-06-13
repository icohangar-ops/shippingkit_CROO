import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { safeFetch } from "@/lib/resilience";

const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

// Bound the upstream AI Gateway call: per-attempt timeout + backoff on
// 429/5xx/network errors. Restricts egress to the gateway host (SSRF guard).
const GATEWAY_TIMEOUT_MS = 25_000;
const GATEWAY_MAX_ATTEMPTS = 3;
const GATEWAY_ALLOWED_HOSTS = ["ai.gateway.lovable.dev"];

export function createLovableAiGatewayProvider(lovableApiKey: string, initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  let resolveRunId: (value: string | undefined) => void = () => {};
  let runIdResolved = false;
  const runIdReady = new Promise<string | undefined>((resolve) => {
    resolveRunId = resolve;
  });

  const publishRunId = (value?: string) => {
    const nextRunId = value?.trim() || undefined;
    if (!runId && nextRunId) runId = nextRunId;
    if (!runIdResolved) {
      runIdResolved = true;
      resolveRunId(runId);
    }
  };
  if (runId) publishRunId(runId);

  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER)) {
        headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
      }
      try {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input
              : input.url;
        const response = await safeFetch(url, {
          ...init,
          headers,
          timeoutMs: GATEWAY_TIMEOUT_MS,
          maxAttempts: GATEWAY_MAX_ATTEMPTS,
          allowlist: GATEWAY_ALLOWED_HOSTS,
        });
        publishRunId(response.headers.get(LOVABLE_AIG_RUN_ID_HEADER) ?? undefined);
        return response;
      } catch (error) {
        publishRunId(undefined);
        throw error;
      }
    },
  });

  return Object.assign(provider, {
    getRunId: () => runId,
    waitForRunId: () => (runId ? Promise.resolve(runId) : runIdReady),
  });
}