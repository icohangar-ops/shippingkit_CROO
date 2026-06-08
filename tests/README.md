# ShipKit E2E Harness

Validates that a ShipKit-generated provider correctly wires the full
`@croo-network/sdk` lifecycle:
`NegotiationCreated → acceptNegotiation → OrderCreated → OrderPaid → deliverOrder → OrderCompleted`.

## Mock mode (default — no creds, no network)

```bash
bun ./scripts/e2e-shipkit.ts                          # uses sample provider
bun ./scripts/e2e-shipkit.ts --provider path/to/my-provider.ts
bun ./scripts/e2e-shipkit.ts --expect-type schema     # assert DeliverableType.Schema
```

How it works:
- `node_modules/@croo-network/sdk` is shimmed to `tests/mocks/croo-network-sdk.ts`,
  so any provider that imports `@croo-network/sdk` runs unchanged.
- The runner imports the provider, then drives the canonical event sequence
  through a shared event bus and asserts every required method fired with
  the right arguments — including idempotency on duplicate `OrderPaid`.

## Live mode (real CROO endpoints)

```bash
export CROO_API_URL="https://api.croo.network"
export CROO_WS_URL="wss://api.croo.network/ws"
export CROO_SDK_KEY="croo_sk_..."
bun add @croo-network/sdk        # replace the mock shim with the real package
bun ./scripts/e2e-shipkit.ts --mode live --timeout 15000
```

Live mode opens a real WebSocket as your provider, subscribes to every
`EventType.*`, and reports observed events while a buyer triggers a
negotiation against your Service.

## CI

Pair with the static validator for full coverage:

```bash
bun ./scripts/test-shipkit.ts && bun ./scripts/e2e-shipkit.ts
```