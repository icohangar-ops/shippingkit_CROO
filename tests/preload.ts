// Bun preload: alias `@croo-network/sdk` → local mock so any ShipKit-generated
// provider runs unchanged against the harness. Run via:
//   bun --preload ./tests/preload.ts scripts/e2e-shipkit.ts

import { plugin } from "bun";
import path from "node:path";

const mockPath = path.resolve(import.meta.dir, "mocks/croo-network-sdk.ts");

plugin({
  name: "croo-sdk-mock",
  setup(build) {
    build.onResolve({ filter: /^@croo-network\/sdk$/ }, () => ({
      path: mockPath,
    }));
  },
});