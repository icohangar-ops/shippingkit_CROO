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

### Reports

Every run writes a timestamped pair to `reports/`:

- `<name>.json` — machine-readable timeline (events, calls, asserts) with
  per-step `expected` / `actual` payloads and unified diffs.
- `<name>.html` — standalone, dark-themed report. Filter by All / Failing /
  Warnings, expand any step to inspect expected vs. actual, and click
  **⬇ Export failing traces (JSON)** for a one-click download of every
  failure + warning (or **📋 Copy** to send straight to the clipboard).

Flags: `--report-dir <path>` (default `reports`), `--report-name <slug>`,
`--no-report` to skip writing.

## CI

`.github/workflows/shipkit-e2e.yml` runs the static + E2E harness on every
push / PR and always uploads `reports/*.html` + `reports/*.json` as the
`shipkit-e2e-reports-<run-id>` artifact (30-day retention). On failure it
also extracts every `fail`/`warn` timeline entry into a second
`shipkit-e2e-failing-<run-id>` artifact for quick triage, and writes a
pass/fail table to the GitHub job summary. Trigger ad-hoc runs via
**Actions → ShipKit E2E → Run workflow** (override `provider` and
`expect-type` inputs).

On pull requests the workflow also posts (and updates in place) a sticky
`ShipKit E2E` comment with the overall verdict, direct download links to
the `shipkit-e2e-reports` + `shipkit-e2e-failing` artifacts, and a table
of the first 10 failing/warning steps (`+ts`, phase, step, expected,
actual) for at-a-glance triage without leaving the PR.

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