import { and, asc, eq } from "drizzle-orm";
import {
  firmOndemandServices,
  firms,
  serviceOrderAttachments,
  serviceOrderEvents,
  serviceOrderItems,
  serviceOrders,
  type FirmOndemandService,
  type ServiceOrder,
} from "../drizzle/schema";
import { getDb } from "./db";
import { DEFAULT_CURRENCY, normalizeCurrency } from "../shared/currencies";

const LOCK_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export function publicService(svc: FirmOndemandService) {
  return {
    id: svc.id,
    name: svc.name,
    description: svc.description,
    category: svc.category,
    fulfillmentType: svc.fulfillmentType,
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

export function isOrderLocked(order: ServiceOrder, now = new Date()) {
  if (order.lockedAt) return true;
  if (order.status === "completed" && order.completedAt) {
    return now.getTime() - new Date(order.completedAt).getTime() >= LOCK_AFTER_MS;
  }
  return false;
}

export function revisionsRemaining(order: ServiceOrder) {
  return Math.max(0, (order.maxRevisions ?? 2) - (order.revisionsUsed ?? 0));
}

export function orderPublicView(order: ServiceOrder, now = new Date()) {
  const locked = isOrderLocked(order, now);
  return {
    ...order,
    isLocked: locked,
    revisionsRemaining: revisionsRemaining(order),
    canSubmitIntake:
      !locked &&
      !order.intakeSubmittedAt &&
      ["awaiting_intake", "awaiting_acceptance", "paid"].includes(order.status),
    canRequestRevision:
      !locked &&
      order.status === "delivered" &&
      order.fulfillmentType === "document" &&
      revisionsRemaining(order) > 0,
    canCompleteAsClient: !locked && ["delivered", "in_progress"].includes(order.status),
  };
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
  const [firmRow] = await db
    .select({ defaultCurrency: firms.defaultCurrency })
    .from(firms)
    .where(eq(firms.id, opts.firmId))
    .limit(1);
  const currency = normalizeCurrency(firmRow?.defaultCurrency || DEFAULT_CURRENCY);
  const result = await db.insert(serviceOrders).values({
    firmId: opts.firmId,
    clientId: opts.clientId,
    orderNumber: makeOrderNumber(),
    status: "cart",
    subtotal: "0.00",
    currency,
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

export async function getOrderAttachments(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(serviceOrderAttachments)
    .where(eq(serviceOrderAttachments.orderId, orderId))
    .orderBy(asc(serviceOrderAttachments.createdAt));
}

export async function getOrderEvents(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(serviceOrderEvents)
    .where(eq(serviceOrderEvents.orderId, orderId))
    .orderBy(asc(serviceOrderEvents.createdAt));
}

export async function addOrderEvent(opts: {
  orderId: number;
  firmId: number;
  type: (typeof serviceOrderEvents.$inferInsert)["type"];
  body?: string | null;
  authorUserId?: number | null;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(serviceOrderEvents).values({
    orderId: opts.orderId,
    firmId: opts.firmId,
    type: opts.type,
    body: opts.body || null,
    authorUserId: opts.authorUserId ?? null,
  });
}

/** Infer fulfillment type from line items (consultation if any advice/consultation service). */
export async function resolveOrderFulfillmentType(orderId: number) {
  const db = await getDb();
  if (!db) return "document" as const;
  const items = await db
    .select()
    .from(serviceOrderItems)
    .where(eq(serviceOrderItems.orderId, orderId));
  for (const item of items) {
    const [svc] = await db
      .select()
      .from(firmOndemandServices)
      .where(eq(firmOndemandServices.id, item.serviceId))
      .limit(1);
    if (svc?.fulfillmentType === "consultation" || svc?.category === "advice") {
      return "consultation" as const;
    }
  }
  return "document" as const;
}

export async function markServiceOrderPaid(orderId: number, firmId?: number) {
  const db = await getDb();
  if (!db) return false;
  const [order] = await db.select().from(serviceOrders).where(eq(serviceOrders.id, orderId)).limit(1);
  if (!order) return false;
  if (firmId && order.firmId !== firmId) return false;
  if (
    ![
      "pending_payment",
      "cart",
      "paid",
      "awaiting_acceptance",
      "awaiting_intake",
    ].includes(order.status)
  ) {
    return false;
  }
  if (["awaiting_intake", "awaiting_acceptance", "paid"].includes(order.status) && order.paidAt) {
    return true;
  }
  const fulfillmentType = await resolveOrderFulfillmentType(orderId);
  await db
    .update(serviceOrders)
    .set({
      status: "awaiting_intake",
      paidAt: new Date(),
      fulfillmentType,
    })
    .where(eq(serviceOrders.id, orderId));
  await addOrderEvent({
    orderId,
    firmId: order.firmId,
    type: "system",
    body: "Payment received. Client can now submit documents or consultation details.",
  });
  return true;
}

/** Auto-lock completed orders older than 7 days (idempotent). */
export async function maybeLockOrder(order: ServiceOrder) {
  if (order.lockedAt) return order;
  if (!isOrderLocked(order)) return order;
  const db = await getDb();
  if (!db) return order;
  const lockedAt = new Date();
  await db
    .update(serviceOrders)
    .set({ lockedAt })
    .where(eq(serviceOrders.id, order.id));
  await addOrderEvent({
    orderId: order.id,
    firmId: order.firmId,
    type: "locked",
    body: "Order locked 7 days after completion. No further changes or revisions.",
  });
  return { ...order, lockedAt };
}

export type { FirmOndemandService, ServiceOrder };
