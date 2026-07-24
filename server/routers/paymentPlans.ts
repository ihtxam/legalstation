import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { paymentPlans, paymentInstallments, invoices } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { getFirmMemberByUserId, getInvoiceById, getClientByUserId } from "../db";
import {
  generateInvoiceForInstallment,
  processDuePaymentPlanInstallments,
} from "../paymentPlanInvoices";

/**
 * Payment plan router — lawyers define custom payment schedules for invoices
 * E.g., "3 monthly installments", "50% upfront + 50% on completion"
 */

export const paymentPlansRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        invoiceId: z.number(),
        name: z.string().min(1),
        description: z.string().optional(),
        installmentCount: z.number().min(1).max(12),
        intervalDays: z.number().min(0),
        autoGenerateInvoices: z.boolean().optional().default(true),
        generateDueNow: z.boolean().optional().default(true),
        installments: z.array(
          z.object({
            installmentNumber: z.number().min(1),
            amount: z.number().min(0),
            daysFromNow: z.number().min(0),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const invoice = await getInvoiceById(input.invoiceId, member.firmId);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });

      const totalAmount = input.installments.reduce((sum, inst) => sum + inst.amount, 0);

      const planResult = await db.insert(paymentPlans).values({
        invoiceId: input.invoiceId,
        name: input.name,
        description: input.description,
        totalAmount: totalAmount.toString(),
        installmentCount: input.installmentCount,
        intervalDays: input.intervalDays,
        autoGenerateInvoices: input.autoGenerateInvoices,
      });

      const planId = planResult[0].insertId as number;
      const now = new Date();
      const createdInstallmentIds: number[] = [];

      for (const inst of input.installments) {
        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + inst.daysFromNow);
        const result = await db.insert(paymentInstallments).values({
          paymentPlanId: planId,
          installmentNumber: inst.installmentNumber,
          amount: inst.amount.toString(),
          dueDate,
          status: "pending",
        });
        createdInstallmentIds.push(result[0].insertId as number);
      }

      const generatedInvoiceIds: number[] = [];
      if (input.autoGenerateInvoices && input.generateDueNow) {
        for (const installmentId of createdInstallmentIds) {
          const [row] = await db
            .select()
            .from(paymentInstallments)
            .where(eq(paymentInstallments.id, installmentId))
            .limit(1);
          if (row && new Date(row.dueDate).getTime() <= Date.now()) {
            const gen = await generateInvoiceForInstallment(installmentId, ctx.user.id);
            if (!gen.alreadyGenerated) generatedInvoiceIds.push(gen.invoiceId);
          }
        }
      }

      return { planId, totalAmount, generatedInvoiceIds };
    }),

  get: protectedProcedure
    .input(z.object({ planId: z.number() }))
    .query(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const plan = await db.select().from(paymentPlans).where(eq(paymentPlans.id, input.planId)).limit(1);
      if (!plan[0]) throw new TRPCError({ code: "NOT_FOUND" });

      const invoice = await getInvoiceById(plan[0].invoiceId, member.firmId);
      if (!invoice) throw new TRPCError({ code: "UNAUTHORIZED" });

      const installments = await db
        .select()
        .from(paymentInstallments)
        .where(eq(paymentInstallments.paymentPlanId, input.planId));

      const totalAmount = installments.reduce((sum, inst) => sum + parseFloat(String(inst.amount)), 0);

      return { plan: plan[0], installments, totalAmount };
    }),

  listByInvoice: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const invoiceRow = await db.select().from(invoices).where(eq(invoices.id, input.invoiceId)).limit(1);
      if (!invoiceRow[0]) throw new TRPCError({ code: "NOT_FOUND" });

      const invoice = invoiceRow[0];
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (member) {
        if (member.firmId !== invoice.firmId) throw new TRPCError({ code: "UNAUTHORIZED" });
      } else {
        const client = await getClientByUserId(ctx.user.id);
        if (!client || client.id !== invoice.clientId) throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const plans = await db
        .select()
        .from(paymentPlans)
        .where(eq(paymentPlans.invoiceId, input.invoiceId));

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

  generateInstallmentInvoice: protectedProcedure
    .input(z.object({ installmentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [installment] = await db
        .select()
        .from(paymentInstallments)
        .where(eq(paymentInstallments.id, input.installmentId))
        .limit(1);
      if (!installment) throw new TRPCError({ code: "NOT_FOUND" });

      const [plan] = await db
        .select()
        .from(paymentPlans)
        .where(eq(paymentPlans.id, installment.paymentPlanId))
        .limit(1);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });

      const invoice = await getInvoiceById(plan.invoiceId, member.firmId);
      if (!invoice) throw new TRPCError({ code: "UNAUTHORIZED" });

      return generateInvoiceForInstallment(input.installmentId, ctx.user.id);
    }),

  generateDue: protectedProcedure.mutation(async ({ ctx }) => {
    const member = await getFirmMemberByUserId(ctx.user.id);
    if (!member || (member.firmRole !== "admin" && ctx.user.role !== "admin" && ctx.user.role !== "superadmin")) {
      // Allow any firm member to trigger for their ops; keep simple for MVP
      if (!member) throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return processDuePaymentPlanInstallments(ctx.user.id);
  }),

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

  delete: protectedProcedure
    .input(z.object({ planId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const plan = await db.select().from(paymentPlans).where(eq(paymentPlans.id, input.planId)).limit(1);
      if (!plan[0]) throw new TRPCError({ code: "NOT_FOUND" });

      const invoice = await getInvoiceById(plan[0].invoiceId, member.firmId);
      if (!invoice) throw new TRPCError({ code: "UNAUTHORIZED" });

      await db.delete(paymentInstallments).where(eq(paymentInstallments.paymentPlanId, input.planId));
      await db.delete(paymentPlans).where(eq(paymentPlans.id, input.planId));

      return { success: true };
    }),
});
