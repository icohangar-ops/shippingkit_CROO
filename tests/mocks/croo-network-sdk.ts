// Mock implementation of @croo-network/sdk used by the ShipKit E2E harness.
// Mirrors the documented surface (AgentClient, EventType, DeliverableType,
// APIError + typed helpers) so a ShipKit-generated provider can be loaded
// unchanged. The __harness singleton is the back-channel used by the runner
// to drive the lifecycle and observe calls.

import { EventEmitter } from "node:events";

export enum EventType {
  NegotiationCreated = "NegotiationCreated",
  NegotiationRejected = "NegotiationRejected",
  NegotiationExpired = "NegotiationExpired",
  OrderCreated = "OrderCreated",
  OrderPaid = "OrderPaid",
  OrderCompleted = "OrderCompleted",
  OrderRejected = "OrderRejected",
  OrderExpired = "OrderExpired",
}

export enum DeliverableType {
  Text = "text",
  Schema = "schema",
}

export class APIError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "APIError";
  }
}

const codeIs = (code: string) => (e: unknown) =>
  e instanceof APIError && e.code === code;

export const isNotFound = codeIs("not_found");
export const isUnauthorized = codeIs("unauthorized");
export const isInvalidParams = codeIs("invalid_params");
export const isInvalidStatus = codeIs("invalid_status");
export const isForbidden = codeIs("forbidden");
export const isInsufficientBalance = codeIs("insufficient_balance");

export interface Config {
  baseURL: string;
  wsURL: string;
  logger?: Console;
}

type Call = { method: string; args: unknown[]; at: number };

class HarnessBus extends EventEmitter {
  calls: Call[] = [];
  subscriptions = new Set<string>();
  record(method: string, args: unknown[]) {
    const call: Call = { method, args, at: Date.now() };
    this.calls.push(call);
    this.emit("call", call);
  }
  reset() {
    this.calls = [];
    this.subscriptions.clear();
    this.removeAllListeners();
  }
}

// Shared singleton — runner imports the same module via the Bun preload
// resolver, so call records and event delivery are shared across modules.
export const __harness: HarnessBus =
  (globalThis as unknown as { __croo_harness?: HarnessBus }).__croo_harness ??
  new HarnessBus();
(globalThis as unknown as { __croo_harness?: HarnessBus }).__croo_harness =
  __harness;

class EventStream extends EventEmitter {
  override on(event: string, handler: (...args: unknown[]) => void): this {
    super.on(event, handler);
    __harness.subscriptions.add(event);
    __harness.emit("subscribed", event);
    return this;
  }
}

export class AgentClient {
  private stream = new EventStream();

  constructor(public config: Config, public sdkKey: string) {
    if (!sdkKey) throw new APIError("unauthorized", "Missing SDK key");
    if (!config?.baseURL || !config?.wsURL) {
      throw new APIError("invalid_params", "Config requires baseURL and wsURL");
    }
    __harness.record("AgentClient", [config, sdkKey]);
    __harness.on("__emit", ({ event, payload }: { event: string; payload: unknown }) => {
      this.stream.emit(event, payload);
    });
  }

  async connectWebSocket(): Promise<EventStream> {
    __harness.record("connectWebSocket", []);
    __harness.emit("connected", this.config.wsURL);
    return this.stream;
  }

  async acceptNegotiation(negotiationId: string) {
    __harness.record("acceptNegotiation", [negotiationId]);
  }
  async acceptNegotiationWithFundAddress(negotiationId: string, addr: string) {
    __harness.record("acceptNegotiationWithFundAddress", [negotiationId, addr]);
  }
  async rejectNegotiation(negotiationId: string, reason: string) {
    __harness.record("rejectNegotiation", [negotiationId, reason]);
  }
  async deliverOrder(
    orderId: string,
    req: { type: DeliverableType; content: unknown },
  ) {
    if (!req || !req.type) {
      throw new APIError("invalid_params", "deliverOrder requires { type, content }");
    }
    if (!Object.values(DeliverableType).includes(req.type)) {
      throw new APIError("invalid_params", `Unknown DeliverableType: ${req.type}`);
    }
    __harness.record("deliverOrder", [orderId, req]);
  }
  async rejectOrder(orderId: string, reason: string) {
    __harness.record("rejectOrder", [orderId, reason]);
  }

  // Requester surface
  async negotiateOrder(req: { service_id: string; input?: unknown }) {
    __harness.record("negotiateOrder", [req]);
    return {
      negotiation_id: "neg_mock_" + Math.random().toString(36).slice(2, 8),
      order_id: "order_mock_" + Math.random().toString(36).slice(2, 8),
      service_id: req.service_id,
    };
  }
  async payOrder(orderId: string) {
    __harness.record("payOrder", [orderId]);
  }
  async getOrder(orderId: string) {
    __harness.record("getOrder", [orderId]);
    return { order_id: orderId, status: "paid" as const };
  }
  async getDelivery(orderId: string) {
    __harness.record("getDelivery", [orderId]);
    const delivered = __harness.calls.find(
      (c) => c.method === "deliverOrder" && c.args[0] === orderId,
    );
    if (!delivered) return null;
    return { order_id: orderId, ...(delivered.args[1] as object) };
  }
}