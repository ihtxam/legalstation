import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { paymentPlans, paymentInstallments, invoices } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getFirmMemberByUserId, getInvoiceById } from "../db";

/**
 * Payment plan router — lawyers define custom payment schedules for invoices
 * E.g., "3 monthly installments", "50% upfront + 50% on completion"
 */

export const paymentPlansRouter = router({
  // ─── Create Payment Plan ──────────────────────────────────────────────────
  create: protectedProcedure
    .input(
      z.object({
        invoiceId: z.number(),
        name: z.string().min(1), // "Monthly 3x", "Upfront + Milestone"
        description: z.string().optional(),
        installmentCount: z.number().min(1).max(12),
        intervalDays: z.number().min(0), // 0 = one-time, 30 = monthly, 365 = yearly
        installments: z.array(
          z.object({
            installmentNumber: z.number().min(1),
            amount: z.number().min(0),
            daysFromNow: z.number().min(0), // Days from today for due date
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify invoice exists and belongs to firm
      const invoice = await getInvoiceById(input.invoiceId, member.firmId);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });

      // Verify installments sum to invoice total
      // TODO: Fetch items and calculate total
      const installmentTotal = input.installments.reduce((sum, inst) => sum + inst.amount, 0); // TODO: Get totalAmount from invoice items
      if (Math.abs(installmentTotal - totalAmount) > 0.01) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Installments total (${installmentTotal}) must equal invoice total (${totalAmount})`,
        });
      }

      // Create payment plan
      const planResult = await db.insert(paymentPlans).values({
        invoiceId: input.invoiceId,
        name: input.name,
        description: input.description,
        totalAmount: totalAmount.toString(),
        installmentCount: input.installmentCount,
        intervalDays: input.intervalDays,
      });

      const planId = planResult[0].insertId as number;

      // Create installments
      const now = new Date();
      await Promise.all(
        input.installments.map((inst) => {
          const dueDate = new Date(now);
          dueDate.setDate(dueDate.getDate() + inst.daysFromNow);

          return db.insert(paymentInstallments).values({
            paymentPlanId: planId,
            installmentNumber: inst.installmentNumber,
            amount: inst.amount.toString(),
            dueDate,
            status: "pending",
          });
        })
      );

      return { planId };
    }),

  // ─── Get Payment Plan ────────────────────────────────────────────────────
  get: protectedProcedure
    .input(z.object({ planId: z.number() }))
    .query(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const plan = await db.select().from(paymentPlans).where(eq(paymentPlans.id, input.planId)).limit(1);
      if (!plan[0]) throw new TRPCError({ code: "NOT_FOUND" });

      // Verify invoice belongs to firm
      const invoice = await getInvoiceById(plan[0].invoiceId, member.firmId);
      if (!invoice) throw new TRPCError({ code: "UNAUTHORIZED" });

      const installments = await db
        .select()
        .from(paymentInstallments)
        .where(eq(paymentInstallments.paymentPlanId, input.planId));

      return { plan: plan[0], installments };
    }),

  // ─── List Payment Plans for Invoice ───────────────────────────────────────
  listByInvoice: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .query(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify invoice belongs to firm
      const invoice = await getInvoiceById(input.invoiceId, member.firmId);
      if (!invoice) throw new TRPCError({ code: "UNAUTHORIZED" });

      const plans = await db
        .select()
        .from(paymentPlans)
        .where(eq(paymentPlans.invoiceId, input.invoiceId));

      // Enrich with installments
      const enriched = await Promise.all(
        plans.map(async (plan) => {
          const installments = await db
            .select()
            .from(paymentInstallments)
            .where(eq(paymentInstallments.paymentPlanId, plan.id));
          return { ...plan, installments };
        })
      );

      return enriched;
    }),

  // ─── Update Installment Status (mark as paid) ────────────────────────────
  markInstallmentPaid: protectedProcedure
    .input(
      z.object({
        installmentId: z.number(),
        adyenPaymentId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .update(paymentInstallments)
        .set({
          status: "paid",
          paidAt: new Date(),
          adyenPaymentId: input.adyenPaymentId,
        })
        .where(eq(paymentInstallments.id, input.installmentId));

      return { success: true };
    }),

  // ─── Delete Payment Plan ──────────────────────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ planId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const plan = await db.select().from(paymentPlans).where(eq(paymentPlans.id, input.planId)).limit(1);
      if (!plan[0]) throw new TRPCError({ code: "NOT_FOUND" });

      // Verify invoice belongs to firm
      const invoice = await getInvoiceById(plan[0].invoiceId, member.firmId);
      if (!invoice) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Delete installments first
      await db.delete(paymentInstallments).where(eq(paymentInstallments.paymentPlanId, input.planId));

      // Delete plan
      await db.delete(paymentPlans).where(eq(paymentPlans.id, input.planId));

      return { success: true };
    }),
});
