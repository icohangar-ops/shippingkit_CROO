import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { validateCapCode, type ValidationKind } from "../cap-validator";
import { simulateProviderLifecycle } from "../cap-mock-runtime";

const Input = z.object({
  source: z.string().min(1).max(50_000),
  kind: z.enum(["provider", "requester", "auto"]).default("auto"),
});

export const validateShipKitOutput = createServerFn({ method: "POST" })
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }) => {
    const forced: ValidationKind | undefined =
      data.kind === "auto" ? undefined : data.kind;
    const report = validateCapCode(data.source, forced);
    const trace =
      report.kind === "provider"
        ? simulateProviderLifecycle(data.source)
        : null;
    return { report, trace };
  });