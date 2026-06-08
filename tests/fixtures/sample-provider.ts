// A canonical ShipKit-generated provider. The E2E harness loads this file
// (or your own --provider path) and validates the WebSocket event flow.

import {
  AgentClient,
  DeliverableType,
  EventType,
  isInsufficientBalance,
} from "@croo-network/sdk";

const client = new AgentClient(
  { baseURL: process.env.CROO_API_URL!, wsURL: process.env.CROO_WS_URL! },
  process.env.CROO_SDK_KEY!,
);

const delivered = new Set<string>();
const stream = await client.connectWebSocket();

stream.on(EventType.NegotiationCreated, async (e: { negotiation_id: string }) => {
  try {
    await client.acceptNegotiation(e.negotiation_id);
  } catch (err) {
    if (isInsufficientBalance(err)) console.error("insufficient balance");
    else throw err;
  }
});

stream.on(EventType.OrderPaid, async (e: { order_id: string }) => {
  if (delivered.has(e.order_id)) return; // idempotency
  delivered.add(e.order_id);
  const content = `Echo of order ${e.order_id} at ${new Date().toISOString()}`;
  await client.deliverOrder(e.order_id, {
    type: DeliverableType.Text,
    content,
  });
});

stream.on(EventType.OrderCompleted, (e: { order_id: string }) => {
  console.log(`[provider] settled ${e.order_id}`);
});