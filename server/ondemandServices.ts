import { and, eq } from "drizzle-orm";
import {
  firmOndemandServices,
  serviceOrderItems,
  serviceOrders,
  type FirmOndemandService,
  type ServiceOrder,
} from "../drizzle/schema";
import { getDb } from "./db";

export function publicService(svc: FirmOndemandService) {
  return {
    id: svc.id,
    name: svc.name,
    description: svc.description,
    category: svc.category,
    price: svc.price,
    currency: svc.currency,
    estimatedHours: Number(svc.estimatedHours || 0),
    deliveryNotes: svc.deliveryNotes,
    defaultCaseType: svc.defaultCaseType,
    sortOrder: svc.sortOrder,
  };
}

export function makeOrderNumber() {
  return `ORD-${Date.now().toString(36).toUpperCase()}`;
}

export async function getOrCreateCart(opts: { firmId: number; clientId: number }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [existing] = await db
    .select()
    .from(serviceOrders)
    .where(
      and(
        eq(serviceOrders.firmId, opts.firmId),
        eq(serviceOrders.clientId, opts.clientId),
        eq(serviceOrders.status, "cart")
      )
    )
    .limit(1);
  if (existing) return existing;
  const result = await db.insert(serviceOrders).values({
    firmId: opts.firmId,
    clientId: opts.clientId,
    orderNumber: makeOrderNumber(),
    status: "cart",
    subtotal: "0.00",
    currency: "CHF",
  });
  const id = Number(result[0].insertId);
  const [created] = await db.select().from(serviceOrders).where(eq(serviceOrders.id, id)).limit(1);
  if (!created) throw new Error("Failed to create cart");
  return created;
}

export async function recomputeOrderSubtotal(orderId: number) {
  const db = await getDb();
  if (!db) return 0;
  const items = await db
    .select()
    .from(serviceOrderItems)
    .where(eq(serviceOrderItems.orderId, orderId));
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.unitPrice) * item.quantity,
    0
  );
  const currency = items[0]?.currency || "CHF";
  await db
    .update(serviceOrders)
    .set({ subtotal: subtotal.toFixed(2), currency })
    .where(eq(serviceOrders.id, orderId));
  return subtotal;
}

export async function getOrderWithItems(orderId: number) {
  const db = await getDb();
  if (!db) return null;
  const [order] = await db.select().from(serviceOrders).where(eq(serviceOrders.id, orderId)).limit(1);
  if (!order) return null;
  const items = await db
    .select()
    .from(serviceOrderItems)
    .where(eq(serviceOrderItems.orderId, orderId));
  return { order, items };
}

export async function markServiceOrderPaid(orderId: number, firmId?: number) {
  const db = await getDb();
  if (!db) return false;
  const [order] = await db.select().from(serviceOrders).where(eq(serviceOrders.id, orderId)).limit(1);
  if (!order) return false;
  if (firmId && order.firmId !== firmId) return false;
  if (!["pending_payment", "cart", "paid", "awaiting_acceptance"].includes(order.status)) {
    return false;
  }
  if (order.status === "paid" || order.status === "awaiting_acceptance") return true;
  await db
    .update(serviceOrders)
    .set({
      status: "awaiting_acceptance",
      paidAt: new Date(),
    })
    .where(eq(serviceOrders.id, orderId));
  return true;
}

export type { FirmOndemandService, ServiceOrder };
