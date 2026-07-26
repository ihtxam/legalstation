import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import {
  clients,
  firmOndemandServices,
  serviceOrderItems,
  serviceOrders,
  users,
} from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import {
  addCaseAssignment,
  createCase,
  createCaseEvent,
  getCaseById,
  getClientByUserId,
  getDb,
  getFirmMemberByUserId,
  getFirmMembers,
  updateCase,
} from "../db";
import { sendCaseUpdateEmail } from "../email";
import { getAppBaseUrl } from "../tenant";
import { getStripe } from "../stripe";
import {
  getOrCreateCart,
  getOrderWithItems,
  markServiceOrderPaid,
  publicService,
  recomputeOrderSubtotal,
} from "../ondemandServices";

const categoryEnum = z.enum([
  "advice",
  "contract",
  "documents",
  "employment",
  "corporate",
  "other",
]);

const caseTypeEnum = z.enum([
  "civil",
  "criminal",
  "corporate",
  "family",
  "real_estate",
  "employment",
  "tax",
  "immigration",
  "intellectual_property",
  "other",
]);

async function requireFirmStaff(userId: number) {
  const member = await getFirmMemberByUserId(userId);
  if (
    !member ||
    !["admin", "subadmin", "lawyer", "collaborator", "assistant"].includes(member.firmRole)
  ) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Firm access required" });
  }
  return member;
}

async function requireFirmAdmin(userId: number) {
  const member = await getFirmMemberByUserId(userId);
  if (!member || !["admin", "subadmin"].includes(member.firmRole)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Firm admin required" });
  }
  return member;
}

export const ondemandServicesRouter = router({
  // ── Firm catalog management ──────────────────────────────────────────────
  listForFirm: protectedProcedure.query(async ({ ctx }) => {
    const member = await requireFirmStaff(ctx.user.id);
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(firmOndemandServices)
      .where(eq(firmOndemandServices.firmId, member.firmId))
      .orderBy(asc(firmOndemandServices.sortOrder), desc(firmOndemandServices.createdAt));
  }),

  createService: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        category: categoryEnum.default("advice"),
        price: z.number().min(0),
        currency: z.string().length(3).default("CHF"),
        estimatedHours: z.number().min(0).max(1000).default(1),
        deliveryNotes: z.string().optional(),
        defaultCaseType: caseTypeEnum.default("other"),
        isActive: z.boolean().optional().default(true),
        isPublic: z.boolean().optional().default(true),
        sortOrder: z.number().int().optional().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result = await db.insert(firmOndemandServices).values({
        firmId: member.firmId,
        name: input.name,
        description: input.description || null,
        category: input.category,
        price: input.price.toFixed(2),
        currency: input.currency.toUpperCase(),
        estimatedHours: input.estimatedHours.toFixed(2),
        deliveryNotes: input.deliveryNotes || null,
        defaultCaseType: input.defaultCaseType,
        isActive: input.isActive,
        isPublic: input.isPublic,
        sortOrder: input.sortOrder,
      });
      return { id: Number(result[0].insertId) };
    }),

  updateService: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional().nullable(),
        category: categoryEnum.optional(),
        price: z.number().min(0).optional(),
        currency: z.string().length(3).optional(),
        estimatedHours: z.number().min(0).max(1000).optional(),
        deliveryNotes: z.string().optional().nullable(),
        defaultCaseType: caseTypeEnum.optional(),
        isActive: z.boolean().optional(),
        isPublic: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db
        .select()
        .from(firmOndemandServices)
        .where(
          and(eq(firmOndemandServices.id, input.id), eq(firmOndemandServices.firmId, member.firmId))
        )
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      const { id: _id, ...rest } = input;
      await db
        .update(firmOndemandServices)
        .set({
          ...("name" in rest ? { name: rest.name } : {}),
          ...("description" in rest ? { description: rest.description ?? null } : {}),
          ...("category" in rest ? { category: rest.category } : {}),
          ...("price" in rest && rest.price != null ? { price: rest.price.toFixed(2) } : {}),
          ...("currency" in rest && rest.currency ? { currency: rest.currency.toUpperCase() } : {}),
          ...("estimatedHours" in rest && rest.estimatedHours != null
            ? { estimatedHours: rest.estimatedHours.toFixed(2) }
            : {}),
          ...("deliveryNotes" in rest ? { deliveryNotes: rest.deliveryNotes ?? null } : {}),
          ...("defaultCaseType" in rest ? { defaultCaseType: rest.defaultCaseType } : {}),
          ...("isActive" in rest ? { isActive: rest.isActive } : {}),
          ...("isPublic" in rest ? { isPublic: rest.isPublic } : {}),
          ...("sortOrder" in rest ? { sortOrder: rest.sortOrder } : {}),
        })
        .where(eq(firmOndemandServices.id, input.id));
      return { success: true as const };
    }),

  // ── Client catalog / cart / checkout ─────────────────────────────────────
  listPublicForClient: protectedProcedure.query(async ({ ctx }) => {
    const client = await getClientByUserId(ctx.user.id);
    if (!client) throw new TRPCError({ code: "FORBIDDEN", message: "Client profile required" });
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select()
      .from(firmOndemandServices)
      .where(
        and(
          eq(firmOndemandServices.firmId, client.firmId),
          eq(firmOndemandServices.isActive, true),
          eq(firmOndemandServices.isPublic, true)
        )
      )
      .orderBy(asc(firmOndemandServices.sortOrder));
    return rows.map(publicService);
  }),

  getCart: protectedProcedure.query(async ({ ctx }) => {
    const client = await getClientByUserId(ctx.user.id);
    if (!client) throw new TRPCError({ code: "FORBIDDEN" });
    const cart = await getOrCreateCart({ firmId: client.firmId, clientId: client.id });
    const full = await getOrderWithItems(cart.id);
    return full;
  }),

  addToCart: protectedProcedure
    .input(
      z.object({
        serviceId: z.number(),
        quantity: z.number().int().min(1).max(20).default(1),
        clientBrief: z.string().max(5000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const client = await getClientByUserId(ctx.user.id);
      if (!client) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [svc] = await db
        .select()
        .from(firmOndemandServices)
        .where(
          and(
            eq(firmOndemandServices.id, input.serviceId),
            eq(firmOndemandServices.firmId, client.firmId),
            eq(firmOndemandServices.isActive, true)
          )
        )
        .limit(1);
      if (!svc) throw new TRPCError({ code: "NOT_FOUND", message: "Service not available" });

      const cart = await getOrCreateCart({ firmId: client.firmId, clientId: client.id });
      const [existing] = await db
        .select()
        .from(serviceOrderItems)
        .where(
          and(
            eq(serviceOrderItems.orderId, cart.id),
            eq(serviceOrderItems.serviceId, svc.id)
          )
        )
        .limit(1);
      if (existing) {
        await db
          .update(serviceOrderItems)
          .set({
            quantity: existing.quantity + input.quantity,
            clientBrief: input.clientBrief ?? existing.clientBrief,
          })
          .where(eq(serviceOrderItems.id, existing.id));
      } else {
        await db.insert(serviceOrderItems).values({
          orderId: cart.id,
          serviceId: svc.id,
          serviceName: svc.name,
          unitPrice: svc.price,
          quantity: input.quantity,
          currency: svc.currency,
          estimatedHours: svc.estimatedHours,
          clientBrief: input.clientBrief || null,
        });
      }
      await recomputeOrderSubtotal(cart.id);
      return getOrderWithItems(cart.id);
    }),

  updateCartItem: protectedProcedure
    .input(
      z.object({
        itemId: z.number(),
        quantity: z.number().int().min(0).max(20),
        clientBrief: z.string().max(5000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const client = await getClientByUserId(ctx.user.id);
      if (!client) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const cart = await getOrCreateCart({ firmId: client.firmId, clientId: client.id });
      const [item] = await db
        .select()
        .from(serviceOrderItems)
        .where(
          and(eq(serviceOrderItems.id, input.itemId), eq(serviceOrderItems.orderId, cart.id))
        )
        .limit(1);
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      if (input.quantity === 0) {
        await db.delete(serviceOrderItems).where(eq(serviceOrderItems.id, item.id));
      } else {
        await db
          .update(serviceOrderItems)
          .set({
            quantity: input.quantity,
            ...(input.clientBrief !== undefined ? { clientBrief: input.clientBrief } : {}),
          })
          .where(eq(serviceOrderItems.id, item.id));
      }
      await recomputeOrderSubtotal(cart.id);
      return getOrderWithItems(cart.id);
    }),

  /**
   * Checkout cart:
   * - With Stripe → pending_payment + Checkout URL
   * - Without Stripe → mark paid / awaiting_acceptance (offline / invoice later)
   */
  checkout: protectedProcedure
    .input(
      z.object({
        clientNotes: z.string().max(5000).optional(),
        payOffline: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const client = await getClientByUserId(ctx.user.id);
      if (!client) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const cart = await getOrCreateCart({ firmId: client.firmId, clientId: client.id });
      const full = await getOrderWithItems(cart.id);
      if (!full || full.items.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cart is empty" });
      }

      await db
        .update(serviceOrders)
        .set({
          clientNotes: input.clientNotes || null,
          status: "pending_payment",
          subtotal: full.order.subtotal,
        })
        .where(eq(serviceOrders.id, cart.id));

      const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY) && !input.payOffline;
      if (stripeReady) {
        try {
          const stripe = getStripe();
          const origin = String(ctx.req.headers.origin || getAppBaseUrl(ctx.req));
          const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "payment",
            customer_email: ctx.user.email ?? client.email ?? undefined,
            line_items: full.items.map((item) => ({
              price_data: {
                currency: item.currency.toLowerCase(),
                product_data: { name: item.serviceName },
                unit_amount: Math.round(Number(item.unitPrice) * 100),
              },
              quantity: item.quantity,
            })),
            metadata: {
              serviceOrderId: String(cart.id),
              firmId: String(client.firmId),
              clientId: String(client.id),
              kind: "ondemand_service_order",
            },
            success_url: `${origin}/client-portal?order=${cart.id}&payment=success`,
            cancel_url: `${origin}/client-portal?order=${cart.id}&payment=cancelled`,
          });
          await db
            .update(serviceOrders)
            .set({
              stripeCheckoutSessionId: session.id,
              stripePaymentUrl: session.url,
            })
            .where(eq(serviceOrders.id, cart.id));
          return {
            orderId: cart.id,
            orderNumber: cart.orderNumber,
            status: "pending_payment" as const,
            paymentUrl: session.url,
          };
        } catch (err: any) {
          console.error("[OnDemand] Stripe checkout failed:", err?.message);
        }
      }

      // Offline / no Stripe: place order as paid and waiting for firm acceptance
      await markServiceOrderPaid(cart.id, client.firmId);
      await notifyFirmNewOrder(client.firmId, cart.id, ctx.req);
      return {
        orderId: cart.id,
        orderNumber: cart.orderNumber,
        status: "awaiting_acceptance" as const,
        paymentUrl: null as string | null,
      };
    }),

  myOrders: protectedProcedure.query(async ({ ctx }) => {
    const client = await getClientByUserId(ctx.user.id);
    if (!client) throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) return [];
    const orders = await db
      .select()
      .from(serviceOrders)
      .where(
        and(
          eq(serviceOrders.clientId, client.id),
          ne(serviceOrders.status, "cart")
        )
      )
      .orderBy(desc(serviceOrders.createdAt));
    const result = [];
    for (const order of orders) {
      const items = await db
        .select()
        .from(serviceOrderItems)
        .where(eq(serviceOrderItems.orderId, order.id));
      result.push({ order, items });
    }
    return result;
  }),

  // ── Firm order desk ──────────────────────────────────────────────────────
  listOrdersForFirm: protectedProcedure
    .input(
      z
        .object({
          status: z
            .enum([
              "pending_payment",
              "paid",
              "awaiting_acceptance",
              "accepted",
              "in_progress",
              "completed",
              "cancelled",
              "rejected",
            ])
            .optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const member = await requireFirmStaff(ctx.user.id);
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          order: serviceOrders,
          client: clients,
        })
        .from(serviceOrders)
        .innerJoin(clients, eq(serviceOrders.clientId, clients.id))
        .where(
          and(
            eq(serviceOrders.firmId, member.firmId),
            ne(serviceOrders.status, "cart"),
            input?.status ? eq(serviceOrders.status, input.status) : undefined
          )
        )
        .orderBy(desc(serviceOrders.createdAt));

      const out = [];
      for (const row of rows) {
        const items = await db
          .select()
          .from(serviceOrderItems)
          .where(eq(serviceOrderItems.orderId, row.order.id));
        out.push({ ...row, items });
      }
      return out;
    }),

  markPaid: protectedProcedure
    .input(z.object({ orderId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmStaff(ctx.user.id);
      const ok = await markServiceOrderPaid(input.orderId, member.firmId);
      if (!ok) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot mark this order paid" });
      await notifyFirmNewOrder(member.firmId, input.orderId, ctx.req);
      return { success: true as const };
    }),

  /**
   * Accept a paid order: create a matter/case, attach client, optionally assign lawyer.
   */
  acceptOrder: protectedProcedure
    .input(
      z.object({
        orderId: z.number(),
        lawyerUserId: z.number().optional(),
        caseTitle: z.string().min(3).max(255).optional(),
        caseType: caseTypeEnum.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmStaff(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const full = await getOrderWithItems(input.orderId);
      if (!full || full.order.firmId !== member.firmId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const { order, items } = full;
      if (!["paid", "awaiting_acceptance"].includes(order.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Order must be paid before acceptance (current: ${order.status})`,
        });
      }
      if (order.caseId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Order already has a case" });
      }

      const title =
        input.caseTitle?.trim() ||
        (items.length === 1
          ? items[0].serviceName
          : `Service order ${order.orderNumber}`);
      let resolvedCaseType = input.caseType || "other";
      if (!input.caseType && items[0]) {
        const [svc] = await db
          .select()
          .from(firmOndemandServices)
          .where(eq(firmOndemandServices.id, items[0].serviceId))
          .limit(1);
        if (svc?.defaultCaseType) resolvedCaseType = svc.defaultCaseType;
      }

      const description = [
        `On-demand order ${order.orderNumber}`,
        order.clientNotes ? `Client notes: ${order.clientNotes}` : "",
        "",
        "Services:",
        ...items.map(
          (i) =>
            `- ${i.serviceName} × ${i.quantity} (${i.estimatedHours}h) — ${Number(i.unitPrice).toFixed(2)} ${i.currency}` +
            (i.clientBrief ? `\n  Brief: ${i.clientBrief}` : "")
        ),
        "",
        `Total paid: ${Number(order.subtotal).toFixed(2)} ${order.currency}`,
      ]
        .filter(Boolean)
        .join("\n");

      const ref = `SVC-${order.orderNumber.replace(/^ORD-/, "")}`;
      const insertResult = await createCase({
        firmId: member.firmId,
        title,
        referenceNumber: ref,
        type: resolvedCaseType as any,
        status: input.lawyerUserId ? "open" : "pending",
        description,
        createdByUserId: ctx.user.id,
      });
      const newCaseId = Number((insertResult as { insertId?: number }).insertId ?? 0);
      const newCase = newCaseId ? await getCaseById(newCaseId, member.firmId) : null;
      if (!newCase) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await addCaseAssignment({
        caseId: newCase.id,
        clientId: order.clientId,
        assignmentType: "client",
        assignedByUserId: ctx.user.id,
      });

      if (input.lawyerUserId) {
        await addCaseAssignment({
          caseId: newCase.id,
          userId: input.lawyerUserId,
          assignmentType: "lawyer",
          assignedByUserId: ctx.user.id,
        });
        await updateCase(newCase.id, member.firmId, { status: "open" });
      }

      await createCaseEvent({
        caseId: newCase.id,
        authorUserId: ctx.user.id,
        eventType: "system",
        visibility: "shared",
        title: "Created from on-demand service order",
        content: description,
      });

      await db
        .update(serviceOrders)
        .set({
          status: input.lawyerUserId ? "in_progress" : "accepted",
          acceptedAt: new Date(),
          acceptedByUserId: ctx.user.id,
          assignedLawyerUserId: input.lawyerUserId || null,
          caseId: newCase.id,
        })
        .where(eq(serviceOrders.id, order.id));

      // Notify client
      const [clientRow] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, order.clientId))
        .limit(1);
      if (clientRow?.email) {
        const caseUrl = `${getAppBaseUrl(ctx.req)}/client-portal`;
        await sendCaseUpdateEmail({
          recipientEmail: clientRow.email,
          recipientName:
            clientRow.firstName || clientRow.companyName || clientRow.email,
          caseTitle: newCase.title,
          updateTitle: "Your service order was accepted",
          updateBody: `Order ${order.orderNumber} was accepted. A matter was opened: ${newCase.title}.`,
          caseUrl,
        }).catch((err) => console.error("[Email] accept order:", err.message));
      }

      return { caseId: newCase.id, orderId: order.id };
    }),

  rejectOrder: protectedProcedure
    .input(z.object({ orderId: z.number(), reason: z.string().max(2000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmStaff(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [order] = await db
        .select()
        .from(serviceOrders)
        .where(and(eq(serviceOrders.id, input.orderId), eq(serviceOrders.firmId, member.firmId)))
        .limit(1);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (!["paid", "awaiting_acceptance", "pending_payment"].includes(order.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Order cannot be rejected" });
      }
      await db
        .update(serviceOrders)
        .set({
          status: "rejected",
          rejectedAt: new Date(),
          rejectionReason: input.reason || null,
        })
        .where(eq(serviceOrders.id, order.id));
      return { success: true as const };
    }),

  completeOrder: protectedProcedure
    .input(z.object({ orderId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmStaff(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [order] = await db
        .select()
        .from(serviceOrders)
        .where(and(eq(serviceOrders.id, input.orderId), eq(serviceOrders.firmId, member.firmId)))
        .limit(1);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (!["accepted", "in_progress"].includes(order.status)) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }
      await db
        .update(serviceOrders)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(serviceOrders.id, order.id));
      return { success: true as const };
    }),

  assignLawyerToOrder: protectedProcedure
    .input(z.object({ orderId: z.number(), lawyerUserId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmStaff(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [order] = await db
        .select()
        .from(serviceOrders)
        .where(and(eq(serviceOrders.id, input.orderId), eq(serviceOrders.firmId, member.firmId)))
        .limit(1);
      if (!order?.caseId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Accept the order first to create a case" });
      }
      await addCaseAssignment({
        caseId: order.caseId,
        userId: input.lawyerUserId,
        assignmentType: "lawyer",
        assignedByUserId: ctx.user.id,
      });
      await updateCase(order.caseId, member.firmId, { status: "open" });
      await db
        .update(serviceOrders)
        .set({
          assignedLawyerUserId: input.lawyerUserId,
          status: "in_progress",
        })
        .where(eq(serviceOrders.id, order.id));
      await createCaseEvent({
        caseId: order.caseId,
        authorUserId: ctx.user.id,
        eventType: "assignment",
        visibility: "shared",
        title: "Lawyer assigned from service order",
        content: "A lawyer was assigned to fulfill this on-demand service order.",
      });
      return { success: true as const, caseId: order.caseId };
    }),
});

async function notifyFirmNewOrder(firmId: number, orderId: number, req: any) {
  const db = await getDb();
  if (!db) return;
  const full = await getOrderWithItems(orderId);
  if (!full) return;
  const members = await getFirmMembers(firmId);
  const orderUrl = `${getAppBaseUrl(req)}/services`;
  for (const m of members.filter((x) =>
    ["admin", "subadmin", "lawyer"].includes(x.member.firmRole)
  )) {
    const [u] = await db.select().from(users).where(eq(users.id, m.member.userId)).limit(1);
    if (!u?.email) continue;
    await sendCaseUpdateEmail({
      recipientEmail: u.email,
      recipientName: u.name || u.email,
      caseTitle: `Order ${full.order.orderNumber}`,
      updateTitle: "New on-demand service order",
      updateBody: `A customer placed order ${full.order.orderNumber} (${Number(full.order.subtotal).toFixed(2)} ${full.order.currency}). Review and accept it in On-demand Services.`,
      caseUrl: orderUrl,
    }).catch((err) => console.error("[Email] new order:", err.message));
  }
}
