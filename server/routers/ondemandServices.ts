import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import {
  clients,
  firmOndemandServices,
  firms,
  serviceOrderAttachments,
  serviceOrderItems,
  serviceOrders,
  users,
} from "../../drizzle/schema";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
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
import { createAdyenPaymentLink } from "../adyen";
import { resolveAdyenConfig } from "./adyen";
import {
  addOrderEvent,
  getOrCreateCart,
  getOrderAttachments,
  getOrderEvents,
  getOrderWithItems,
  isOrderLocked,
  markServiceOrderPaid,
  maybeLockOrder,
  orderPublicView,
  publicService,
  recomputeOrderSubtotal,
  revisionsRemaining,
} from "../ondemandServices";

const categoryEnum = z.enum([
  "advice",
  "contract",
  "documents",
  "employment",
  "corporate",
  "other",
]);

const fulfillmentTypeEnum = z.enum(["document", "consultation"]);

const attachmentInput = z.object({
  fileName: z.string().min(1).max(255),
  fileKey: z.string().min(1).max(512),
  fileUrl: z.string().min(1).max(2048),
  mimeType: z.string().max(128).optional().nullable(),
  size: z.number().int().min(0).max(25 * 1024 * 1024).default(0),
  description: z.string().max(2000).optional(),
});

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

  /** Public catalog for a firm (by slug) — used by the CMS "services" block on the public website. */
  listPublicByFirmSlug: publicProcedure
    .input(z.object({ firmSlug: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { firm: null, services: [] as ReturnType<typeof publicService>[] };
      const [firm] = await db.select().from(firms).where(eq(firms.slug, input.firmSlug)).limit(1);
      if (!firm) return { firm: null, services: [] };
      const rows = await db
        .select()
        .from(firmOndemandServices)
        .where(
          and(
            eq(firmOndemandServices.firmId, firm.id),
            eq(firmOndemandServices.isActive, true),
            eq(firmOndemandServices.isPublic, true)
          )
        )
        .orderBy(asc(firmOndemandServices.sortOrder));
      return {
        firm: { id: firm.id, name: firm.name, slug: firm.slug },
        services: rows.map(publicService),
      };
    }),

  createService: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        category: categoryEnum.default("advice"),
        fulfillmentType: fulfillmentTypeEnum.optional(),
        price: z.number().min(0),
        currency: z.string().length(3).optional(),
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
      const fulfillmentType =
        input.fulfillmentType ||
        (input.category === "advice" ? "consultation" : "document");
      const { firms } = await import("../../drizzle/schema");
      const [firmRow] = await db
        .select({ defaultCurrency: firms.defaultCurrency })
        .from(firms)
        .where(eq(firms.id, member.firmId))
        .limit(1);
      let currency = (firmRow?.defaultCurrency || "CHF").toUpperCase();
      if (input.currency) {
        try {
          const { assertCurrencyEnabled } = await import("../platformCurrencies");
          currency = await assertCurrencyEnabled(input.currency);
        } catch (e) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: e instanceof Error ? e.message : "Invalid currency",
          });
        }
      }
      const result = await db.insert(firmOndemandServices).values({
        firmId: member.firmId,
        name: input.name,
        description: input.description || null,
        category: input.category,
        fulfillmentType,
        price: input.price.toFixed(2),
        currency,
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
        fulfillmentType: fulfillmentTypeEnum.optional(),
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
          ...("fulfillmentType" in rest ? { fulfillmentType: rest.fulfillmentType } : {}),
          ...("price" in rest && rest.price != null ? { price: rest.price.toFixed(2) } : {}),
          ...("currency" in rest && rest.currency
            ? {
                currency: await (async () => {
                  try {
                    const { assertCurrencyEnabled } = await import("../platformCurrencies");
                    return await assertCurrencyEnabled(rest.currency!);
                  } catch (e) {
                    throw new TRPCError({
                      code: "BAD_REQUEST",
                      message: e instanceof Error ? e.message : "Invalid currency",
                    });
                  }
                })(),
              }
            : {}),
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
   * Checkout cart payment priority:
   * 1) Firm Adyen (independent merchant)
   * 2) Platform Stripe
   * 3) Offline → awaiting_acceptance (firm marks paid)
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

      const origin = String(ctx.req.headers.origin || getAppBaseUrl(ctx.req));

      if (!input.payOffline) {
        const adyen = await resolveAdyenConfig(client.firmId);
        if (adyen) {
          try {
            const amount = Math.round(Number(full.order.subtotal) * 100);
            const paymentLink = await createAdyenPaymentLink({
              amount,
              currency: full.order.currency || "CHF",
              reference: `SVC-${cart.id}`,
              description: `Order ${cart.orderNumber}`,
              returnUrl: `${origin}/client-portal?order=${cart.id}&payment=success`,
              merchantAccount: adyen.merchantAccount,
              apiKey: adyen.apiKey,
              environment: adyen.environment,
            });
            await db
              .update(serviceOrders)
              .set({
                adyenPaymentLinkId: paymentLink.id,
                adyenPaymentLinkUrl: paymentLink.url,
              })
              .where(eq(serviceOrders.id, cart.id));
            return {
              orderId: cart.id,
              orderNumber: cart.orderNumber,
              status: "pending_payment" as const,
              paymentUrl: paymentLink.url,
              gateway: "adyen" as const,
            };
          } catch (err: any) {
            console.error("[OnDemand] Adyen checkout failed:", err?.message);
          }
        }

        if (process.env.STRIPE_SECRET_KEY) {
          try {
            const stripe = getStripe();
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
              gateway: "stripe" as const,
            };
          } catch (err: any) {
            console.error("[OnDemand] Stripe checkout failed:", err?.message);
          }
        }
      }

      // Offline / no gateway: place order as paid — client submits intake next
      await markServiceOrderPaid(cart.id, client.firmId);
      await notifyFirmNewOrder(client.firmId, cart.id, ctx.req);
      return {
        orderId: cart.id,
        orderNumber: cart.orderNumber,
        status: "awaiting_intake" as const,
        paymentUrl: null as string | null,
        gateway: "offline" as const,
        nextStep: "submit_intake" as const,
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
    for (const raw of orders) {
      const order = await maybeLockOrder(raw);
      const items = await db
        .select()
        .from(serviceOrderItems)
        .where(eq(serviceOrderItems.orderId, order.id));
      result.push({ order: orderPublicView(order), items });
    }
    return result;
  }),

  getOrderDetail: protectedProcedure
    .input(z.object({ orderId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const full = await getOrderWithItems(input.orderId);
      if (!full) throw new TRPCError({ code: "NOT_FOUND" });

      const member = await getFirmMemberByUserId(ctx.user.id);
      const client = await getClientByUserId(ctx.user.id);
      const isFirm = !!member && member.firmId === full.order.firmId;
      const isOwner = !!client && client.id === full.order.clientId;
      if (!isFirm && !isOwner) throw new TRPCError({ code: "FORBIDDEN" });

      const order = await maybeLockOrder(full.order);
      const attachments = await getOrderAttachments(order.id);
      const events = await getOrderEvents(order.id);
      let assigneeName: string | null = null;
      if (order.assignedLawyerUserId) {
        const [u] = await db
          .select()
          .from(users)
          .where(eq(users.id, order.assignedLawyerUserId))
          .limit(1);
        assigneeName = u?.name || u?.email || null;
      }
      return {
        order: orderPublicView(order),
        items: full.items,
        attachments,
        events,
        assigneeName,
        viewer: isFirm ? ("firm" as const) : ("client" as const),
      };
    }),

  /** Client submits immutable intake (docs + description, or consultation details). */
  submitClientIntake: protectedProcedure
    .input(
      z.object({
        orderId: z.number(),
        description: z.string().min(10).max(10000),
        attachments: z.array(attachmentInput).max(10).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const client = await getClientByUserId(ctx.user.id);
      if (!client) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const full = await getOrderWithItems(input.orderId);
      if (!full || full.order.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      let order = await maybeLockOrder(full.order);
      if (isOrderLocked(order)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Order is locked" });
      }
      if (order.intakeSubmittedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Intake already submitted and cannot be changed",
        });
      }
      if (!["awaiting_intake", "awaiting_acceptance", "paid"].includes(order.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Order is not waiting for client intake",
        });
      }
      if (order.fulfillmentType === "document" && input.attachments.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Upload at least one document for this service",
        });
      }

      for (const file of input.attachments) {
        await db.insert(serviceOrderAttachments).values({
          orderId: order.id,
          firmId: order.firmId,
          kind: "client_source",
          round: 1,
          fileName: file.fileName,
          fileKey: file.fileKey,
          fileUrl: file.fileUrl,
          mimeType: file.mimeType || null,
          size: file.size,
          description: file.description || null,
          uploadedByUserId: ctx.user.id,
        });
      }

      await db
        .update(serviceOrders)
        .set({
          intakeDescription: input.description.trim(),
          intakeSubmittedAt: new Date(),
          status: "ready_for_firm",
        })
        .where(eq(serviceOrders.id, order.id));

      await addOrderEvent({
        orderId: order.id,
        firmId: order.firmId,
        type: "intake_submitted",
        body: input.description.trim(),
        authorUserId: ctx.user.id,
      });

      await notifyFirmIntakeReady(order.firmId, order.id, ctx.req);
      return { success: true as const };
    }),

  /** Client requests a revision (max 2) after firm delivery. */
  requestRevision: protectedProcedure
    .input(
      z.object({
        orderId: z.number(),
        message: z.string().min(5).max(5000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const client = await getClientByUserId(ctx.user.id);
      if (!client) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const full = await getOrderWithItems(input.orderId);
      if (!full || full.order.clientId !== client.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      let order = await maybeLockOrder(full.order);
      if (isOrderLocked(order)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Order is locked" });
      }
      if (order.fulfillmentType !== "document") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Revisions are only available for document services",
        });
      }
      if (order.status !== "delivered") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You can request a revision after the firm delivers work",
        });
      }
      if (revisionsRemaining(order) <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No revisions remaining on this order",
        });
      }

      const used = (order.revisionsUsed || 0) + 1;
      await db
        .update(serviceOrders)
        .set({
          status: "revision_requested",
          revisionsUsed: used,
        })
        .where(eq(serviceOrders.id, order.id));

      await addOrderEvent({
        orderId: order.id,
        firmId: order.firmId,
        type: "revision_requested",
        body: input.message.trim(),
        authorUserId: ctx.user.id,
      });

      await notifyFirmRevision(order.firmId, order.id, input.message.trim(), ctx.req);
      return { success: true as const, revisionsUsed: used };
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
              "awaiting_intake",
              "ready_for_firm",
              "accepted",
              "in_progress",
              "delivered",
              "revision_requested",
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
        const order = await maybeLockOrder(row.order);
        const items = await db
          .select()
          .from(serviceOrderItems)
          .where(eq(serviceOrderItems.orderId, order.id));
        out.push({ order: orderPublicView(order), client: row.client, items });
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
      if (isOrderLocked(order)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Order is locked" });
      }
      if (
        !["paid", "awaiting_acceptance", "awaiting_intake", "ready_for_firm"].includes(order.status)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Order cannot be accepted yet (current: ${order.status})`,
        });
      }
      if (!order.intakeSubmittedAt && order.status !== "awaiting_acceptance") {
        // Prefer waiting for client intake, but allow legacy awaiting_acceptance
        if (order.status === "awaiting_intake") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Wait for the client to submit documents or consultation details first",
          });
        }
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
        `Fulfillment: ${order.fulfillmentType}`,
        order.clientNotes ? `Client notes: ${order.clientNotes}` : "",
        order.intakeDescription ? `Client intake:\n${order.intakeDescription}` : "",
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
          updateBody: `Order ${order.orderNumber} was accepted and assigned. Track progress under Ordered services in your portal.`,
          caseUrl,
        }).catch((err) => console.error("[Email] accept order:", err.message));
      }

      await addOrderEvent({
        orderId: order.id,
        firmId: order.firmId,
        type: "assigned",
        body: input.lawyerUserId
          ? `Accepted and assigned to lawyer #${input.lawyerUserId}`
          : "Order accepted — awaiting assignment",
        authorUserId: ctx.user.id,
      });

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
      if (
        ![
          "paid",
          "awaiting_acceptance",
          "awaiting_intake",
          "ready_for_firm",
          "pending_payment",
        ].includes(order.status)
      ) {
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

  /** Firm uploads corrected/approved document (or delivery note) for the client. */
  deliverWork: protectedProcedure
    .input(
      z.object({
        orderId: z.number(),
        note: z.string().max(5000).optional(),
        attachments: z.array(attachmentInput).max(10).default([]),
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
      let order = await maybeLockOrder(full.order);
      if (isOrderLocked(order)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Order is locked" });
      }
      if (
        !["accepted", "in_progress", "revision_requested", "delivered"].includes(order.status)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Accept and assign the order before delivering work",
        });
      }
      if (order.fulfillmentType === "document" && input.attachments.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Upload the corrected / approved document",
        });
      }

      const priorDeliveries = (await getOrderAttachments(order.id)).filter(
        (a) => a.kind === "firm_deliverable"
      );
      const round = priorDeliveries.length + 1;
      for (const file of input.attachments) {
        await db.insert(serviceOrderAttachments).values({
          orderId: order.id,
          firmId: order.firmId,
          kind: "firm_deliverable",
          round,
          fileName: file.fileName,
          fileKey: file.fileKey,
          fileUrl: file.fileUrl,
          mimeType: file.mimeType || null,
          size: file.size,
          description: file.description || input.note || null,
          uploadedByUserId: ctx.user.id,
        });
      }

      await db
        .update(serviceOrders)
        .set({
          status: "delivered",
          lastDeliveredAt: new Date(),
        })
        .where(eq(serviceOrders.id, order.id));

      await addOrderEvent({
        orderId: order.id,
        firmId: order.firmId,
        type: "delivered",
        body: input.note?.trim() || `Deliverable uploaded (round ${round})`,
        authorUserId: ctx.user.id,
      });

      await notifyClientDelivery(order.clientId, order.id, ctx.req);
      return { success: true as const, round };
    }),

  /** Consultation: lawyer adds call remarks (can also complete in same step). */
  addLawyerRemarks: protectedProcedure
    .input(
      z.object({
        orderId: z.number(),
        remarks: z.string().min(3).max(10000),
        complete: z.boolean().optional().default(false),
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
      let order = await maybeLockOrder(full.order);
      if (isOrderLocked(order)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Order is locked" });
      }
      if (!["accepted", "in_progress", "delivered"].includes(order.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Order is not in progress" });
      }

      await db
        .update(serviceOrders)
        .set({
          lawyerRemarks: input.remarks.trim(),
          ...(input.complete
            ? { status: "completed" as const, completedAt: new Date() }
            : order.status !== "delivered"
              ? { status: "in_progress" as const }
              : {}),
        })
        .where(eq(serviceOrders.id, order.id));
      await addOrderEvent({
        orderId: order.id,
        firmId: order.firmId,
        type: input.complete ? "completed" : "remark",
        body: input.remarks.trim(),
        authorUserId: ctx.user.id,
      });
      return { success: true as const };
    }),

  completeOrder: protectedProcedure
    .input(z.object({ orderId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmStaff(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [raw] = await db
        .select()
        .from(serviceOrders)
        .where(and(eq(serviceOrders.id, input.orderId), eq(serviceOrders.firmId, member.firmId)))
        .limit(1);
      if (!raw) throw new TRPCError({ code: "NOT_FOUND" });
      const order = await maybeLockOrder(raw);
      if (isOrderLocked(order)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Order is locked" });
      }
      if (
        !["accepted", "in_progress", "delivered", "revision_requested"].includes(order.status)
      ) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }
      await db
        .update(serviceOrders)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(serviceOrders.id, order.id));
      await addOrderEvent({
        orderId: order.id,
        firmId: order.firmId,
        type: "completed",
        body: "Order marked completed. Client can request changes for 7 days, then it locks permanently.",
        authorUserId: ctx.user.id,
      });
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
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (isOrderLocked(order)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Order is locked" });
      }
      if (!order.caseId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Accept the order first to create a case",
        });
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
      await addOrderEvent({
        orderId: order.id,
        firmId: order.firmId,
        type: "assigned",
        body: `Assigned to lawyer #${input.lawyerUserId}`,
        authorUserId: ctx.user.id,
      });
      return { success: true as const, caseId: order.caseId };
    }),
});

async function notifyFirmStaff(
  firmId: number,
  opts: { title: string; body: string; orderNumber: string; req: any }
) {
  const db = await getDb();
  if (!db) return;
  const members = await getFirmMembers(firmId);
  const orderUrl = `${getAppBaseUrl(opts.req)}/services`;
  for (const m of members.filter((x) =>
    ["admin", "subadmin", "lawyer"].includes(x.member.firmRole)
  )) {
    const [u] = await db.select().from(users).where(eq(users.id, m.member.userId)).limit(1);
    if (!u?.email) continue;
    await sendCaseUpdateEmail({
      recipientEmail: u.email,
      recipientName: u.name || u.email,
      caseTitle: `Order ${opts.orderNumber}`,
      updateTitle: opts.title,
      updateBody: opts.body,
      caseUrl: orderUrl,
    }).catch((err) => console.error("[Email] order notify:", err.message));
  }
}

async function notifyFirmNewOrder(firmId: number, orderId: number, req: any) {
  const full = await getOrderWithItems(orderId);
  if (!full) return;
  await notifyFirmStaff(firmId, {
    req,
    orderNumber: full.order.orderNumber,
    title: "New on-demand service order",
    body: `A customer placed order ${full.order.orderNumber} (${Number(full.order.subtotal).toFixed(2)} ${full.order.currency}). They will submit documents or consultation details next, then you can assign the work.`,
  });
}

async function notifyFirmIntakeReady(firmId: number, orderId: number, req: any) {
  const full = await getOrderWithItems(orderId);
  if (!full) return;
  await notifyFirmStaff(firmId, {
    req,
    orderNumber: full.order.orderNumber,
    title: "Client submitted order materials",
    body: `Order ${full.order.orderNumber} is ready. Open it in On-demand Services to assign a team member and deliver the work.`,
  });
}

async function notifyFirmRevision(
  firmId: number,
  orderId: number,
  message: string,
  req: any
) {
  const full = await getOrderWithItems(orderId);
  if (!full) return;
  await notifyFirmStaff(firmId, {
    req,
    orderNumber: full.order.orderNumber,
    title: "Client requested a revision",
    body: `Order ${full.order.orderNumber}: ${message}`,
  });
}

async function notifyClientDelivery(clientId: number, orderId: number, req: any) {
  const db = await getDb();
  if (!db) return;
  const full = await getOrderWithItems(orderId);
  if (!full) return;
  const [clientRow] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!clientRow?.email) return;
  await sendCaseUpdateEmail({
    recipientEmail: clientRow.email,
    recipientName: clientRow.firstName || clientRow.companyName || clientRow.email,
    caseTitle: `Order ${full.order.orderNumber}`,
    updateTitle: "Your order has a delivery",
    updateBody: `The firm uploaded work for order ${full.order.orderNumber}. Open Ordered services to review. You may request up to ${full.order.maxRevisions} revision(s).`,
    caseUrl: `${getAppBaseUrl(req)}/client-portal`,
  }).catch((err) => console.error("[Email] delivery:", err.message));
}
