import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createInvoice,
  createInvoiceItem,
  deleteInvoiceItems,
  getFirmMemberByUserId,
  getInvoiceById,
  getInvoiceItems,
  getInvoicesByClient,
  getInvoicesByFirm,
  getNextInvoiceNumber,
  updateInvoice,
  getClientByUserId,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export const invoicesRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (member) {
        const all = await getInvoicesByFirm(member.firmId);
        if (input?.status) return all.filter(r => r.invoice.status === input.status);
        return all;
      }
      const client = await getClientByUserId(ctx.user.id);
      if (client) return getInvoicesByClient(client.id);
      return [];
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member) throw new TRPCError({ code: "UNAUTHORIZED" });
      const invoice = await getInvoiceById(input.id, member.firmId);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
      const items = await getInvoiceItems(invoice.id);
      return { ...invoice, items };
    }),

  create: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      caseId: z.number().optional(),
      dueDate: z.number(),
      vatRate: z.number().default(7.7),
      currency: z.string().default("CHF"),
      notes: z.string().optional(),
      items: z.array(z.object({
        description: z.string().min(1),
        billingType: z.enum(["hourly", "flat_fee"]),
        quantity: z.number().positive(),
        unitPrice: z.number().positive(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member || !["admin", "lawyer"].includes(member.firmRole)) throw new TRPCError({ code: "FORBIDDEN" });
      const invoiceNumber = await getNextInvoiceNumber(member.firmId);
      const subtotal = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const vatAmount = subtotal * (input.vatRate / 100);
      const total = subtotal + vatAmount;
      await createInvoice({
        firmId: member.firmId,
        clientId: input.clientId,
        caseId: input.caseId,
        invoiceNumber,
        dueDate: new Date(input.dueDate),
        vatRate: String(input.vatRate),
        vatAmount: String(vatAmount.toFixed(2)),
        subtotal: String(subtotal.toFixed(2)),
        total: String(total.toFixed(2)),
        currency: input.currency,
        notes: input.notes,
        createdByUserId: ctx.user.id,
      });
      const allInvoices = await getInvoicesByFirm(member.firmId);
      const newInvoice = allInvoices[0]?.invoice;
      if (newInvoice) {
        for (let i = 0; i < input.items.length; i++) {
          const item = input.items[i];
          await createInvoiceItem({
            invoiceId: newInvoice.id,
            description: item.description,
            billingType: item.billingType,
            quantity: String(item.quantity),
            unitPrice: String(item.unitPrice),
            amount: String((item.quantity * item.unitPrice).toFixed(2)),
            sortOrder: i,
          });
        }
      }
      return newInvoice;
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member || !["admin", "lawyer"].includes(member.firmRole)) throw new TRPCError({ code: "FORBIDDEN" });
      const updates: Record<string, unknown> = { status: input.status };
      if (input.status === "paid") updates.paidAt = new Date();
      await updateInvoice(input.id, member.firmId, updates as any);
      return { success: true };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      clientId: z.number().optional(),
      caseId: z.number().optional().nullable(),
      dueDate: z.number().optional(),
      vatRate: z.number().optional(),
      currency: z.string().optional(),
      notes: z.string().optional(),
      items: z.array(z.object({
        description: z.string().min(1),
        billingType: z.enum(["hourly", "flat_fee"]),
        quantity: z.number().positive(),
        unitPrice: z.number().positive(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member || !["admin", "lawyer"].includes(member.firmRole)) throw new TRPCError({ code: "FORBIDDEN" });
      const invoice = await getInvoiceById(input.id, member.firmId);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
      if (invoice.status !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft invoices can be edited" });
      const { id, items, dueDate, ...rest } = input;
      if (items) {
        await deleteInvoiceItems(id);
        const vatRate = input.vatRate ?? Number(invoice.vatRate);
        const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
        const vatAmount = subtotal * (vatRate / 100);
        const total = subtotal + vatAmount;
        await updateInvoice(id, member.firmId, {
          ...rest,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          subtotal: String(subtotal.toFixed(2)),
          vatAmount: String(vatAmount.toFixed(2)),
          total: String(total.toFixed(2)),
        } as any);
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          await createInvoiceItem({
            invoiceId: id,
            description: item.description,
            billingType: item.billingType,
            quantity: String(item.quantity),
            unitPrice: String(item.unitPrice),
            amount: String((item.quantity * item.unitPrice).toFixed(2)),
            sortOrder: i,
          });
        }
      } else {
        await updateInvoice(id, member.firmId, { ...rest, dueDate: dueDate ? new Date(dueDate) : undefined } as any);
      }
      return { success: true };
    }),
});
