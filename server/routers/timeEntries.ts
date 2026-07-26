import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { canSeeFirmWideCases } from "@shared/roles";
import { getFirmCapabilityMatrix } from "../firmPermissions";
import { protectedProcedure, router } from "../_core/trpc";

async function canManageFirmTime(member: { firmId: number; firmRole: string }) {
  const { matrix } = await getFirmCapabilityMatrix(member.firmId);
  return canSeeFirmWideCases(member.firmRole, matrix);
}
import {
  createInvoice,
  createInvoiceItem,
  createTimeEntry,
  deleteTimeEntry,
  getCaseById,
  getCurrentLawyerRate,
  getFirmById,
  getFirmMemberByUserId,
  getNextInvoiceNumber,
  getTimeEntriesByFirm,
  getTimeEntryById,
  updateTimeEntry,
  upsertLawyerRate,
  getInvoicesByFirm,
  getActiveTimerForLawyer,
  createActiveTimer,
  updateActiveTimer,
  deleteActiveTimer,
  elapsedSecondsFromTimer,
} from "../db";
import { DEFAULT_CURRENCY, normalizeCurrency } from "../../shared/currencies";
import {
  canTransitionTimeEntryStatus,
  computeTimeEntryAmount,
  minutesToHours,
  summarizeTimeEntries,
  type TimeEntryStatus,
} from "../timeTracking";

async function requireFirmMember(userId: number) {
  const member = await getFirmMemberByUserId(userId);
  if (!member) throw new TRPCError({ code: "UNAUTHORIZED" });
  return member;
}

export const timeEntriesRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          caseId: z.number().optional(),
          status: z.enum(["draft", "submitted", "billed"]).optional(),
          from: z.string().optional(),
          to: z.string().optional(),
          mineOnly: z.boolean().optional().default(true),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const member = await requireFirmMember(ctx.user.id);
      const firmWide = await canManageFirmTime(member);
      return getTimeEntriesByFirm(member.firmId, {
        lawyerId: input?.mineOnly === false && firmWide ? undefined : ctx.user.id,
        caseId: input?.caseId,
        status: input?.status,
        from: input?.from ? new Date(input.from) : undefined,
        to: input?.to ? new Date(input.to) : undefined,
      });
    }),

  summary: protectedProcedure
    .input(
      z
        .object({
          from: z.string().optional(),
          to: z.string().optional(),
          mineOnly: z.boolean().optional().default(true),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const member = await requireFirmMember(ctx.user.id);
      const firmWide = await canManageFirmTime(member);
      const entries = await getTimeEntriesByFirm(member.firmId, {
        lawyerId: input?.mineOnly === false && firmWide ? undefined : ctx.user.id,
        from: input?.from ? new Date(input.from) : undefined,
        to: input?.to ? new Date(input.to) : undefined,
      });
      const rate = await getCurrentLawyerRate(member.firmId, ctx.user.id);
      const defaultRate = rate ? parseFloat(String(rate.hourlyRate)) : 0;
      const summary = summarizeTimeEntries(
        entries.map((e) => ({
          durationMinutes: e.durationMinutes,
          billable: e.billable,
          hourlyRate: e.hourlyRate != null ? parseFloat(String(e.hourlyRate)) : null,
          status: e.status as TimeEntryStatus,
        })),
        defaultRate
      );
      return {
        ...summary,
        totalHours: minutesToHours(summary.totalMinutes),
        billableHours: minutesToHours(summary.billableMinutes),
        defaultHourlyRate: defaultRate,
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        caseId: z.number(),
        description: z
          .string()
          .trim()
          .min(1, { error: "Please add a description for this time entry." }),
        durationMinutes: z.number().int().positive(),
        date: z.string(),
        billable: z.boolean().optional().default(true),
        hourlyRate: z.number().positive().optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmMember(ctx.user.id);
      const caseRow = await getCaseById(input.caseId, member.firmId);
      if (!caseRow) throw new TRPCError({ code: "NOT_FOUND", message: "Case not found" });

      let hourlyRate = input.hourlyRate;
      if (hourlyRate == null) {
        const rate = await getCurrentLawyerRate(member.firmId, ctx.user.id);
        if (rate) hourlyRate = parseFloat(String(rate.hourlyRate));
      }

      const id = await createTimeEntry({
        firmId: member.firmId,
        caseId: input.caseId,
        lawyerId: ctx.user.id,
        description: input.description,
        durationMinutes: input.durationMinutes,
        hourlyRate: hourlyRate != null ? hourlyRate.toFixed(2) : null,
        billable: input.billable,
        status: "draft",
        date: new Date(input.date),
        startTime: input.startTime ? new Date(input.startTime) : null,
        endTime: input.endTime ? new Date(input.endTime) : null,
      });
      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        description: z
          .string()
          .trim()
          .min(1, { error: "Please add a description for this time entry." })
          .optional(),
        durationMinutes: z.number().int().positive().optional(),
        date: z.string().optional(),
        billable: z.boolean().optional(),
        hourlyRate: z.number().positive().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmMember(ctx.user.id);
      const entry = await getTimeEntryById(input.id, member.firmId);
      if (!entry) throw new TRPCError({ code: "NOT_FOUND" });
      if (entry.lawyerId !== ctx.user.id && !(await canManageFirmTime(member))) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (entry.status === "billed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot edit billed time entries" });
      }

      await updateTimeEntry(input.id, member.firmId, {
        description: input.description,
        durationMinutes: input.durationMinutes,
        date: input.date ? new Date(input.date) : undefined,
        billable: input.billable,
        hourlyRate:
          input.hourlyRate === undefined
            ? undefined
            : input.hourlyRate === null
              ? null
              : input.hourlyRate.toFixed(2),
      });
      return { success: true };
    }),

  setStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["draft", "submitted", "billed"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmMember(ctx.user.id);
      const entry = await getTimeEntryById(input.id, member.firmId);
      if (!entry) throw new TRPCError({ code: "NOT_FOUND" });
      if (entry.lawyerId !== ctx.user.id && !(await canManageFirmTime(member))) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (input.status === "billed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use createInvoiceFromEntries to bill time entries",
        });
      }
      if (!canTransitionTimeEntryStatus(entry.status as TimeEntryStatus, input.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot transition from ${entry.status} to ${input.status}`,
        });
      }
      await updateTimeEntry(input.id, member.firmId, { status: input.status });
      return { success: true };
    }),

  submitMany: protectedProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmMember(ctx.user.id);
      let submitted = 0;
      for (const id of input.ids) {
        const entry = await getTimeEntryById(id, member.firmId);
        if (!entry) continue;
        if (entry.lawyerId !== ctx.user.id && !(await canManageFirmTime(member))) continue;
        if (entry.status !== "draft") continue;
        await updateTimeEntry(id, member.firmId, { status: "submitted" });
        submitted += 1;
      }
      return { submitted };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmMember(ctx.user.id);
      const entry = await getTimeEntryById(input.id, member.firmId);
      if (!entry) throw new TRPCError({ code: "NOT_FOUND" });
      if (entry.lawyerId !== ctx.user.id && !(await canManageFirmTime(member))) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (entry.status === "billed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot delete billed entries" });
      }
      await deleteTimeEntry(input.id, member.firmId);
      return { success: true };
    }),

  setHourlyRate: protectedProcedure
    .input(z.object({ hourlyRate: z.number().positive() }))
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmMember(ctx.user.id);
      const id = await upsertLawyerRate(member.firmId, ctx.user.id, input.hourlyRate);
      return { id, hourlyRate: input.hourlyRate };
    }),

  getHourlyRate: protectedProcedure.query(async ({ ctx }) => {
    const member = await requireFirmMember(ctx.user.id);
    const rate = await getCurrentLawyerRate(member.firmId, ctx.user.id);
    return {
      hourlyRate: rate ? parseFloat(String(rate.hourlyRate)) : null,
    };
  }),

  /** Server-persisted stopwatch for the current lawyer. */
  activeTimer: protectedProcedure.query(async ({ ctx }) => {
    const member = await requireFirmMember(ctx.user.id);
    const timer = await getActiveTimerForLawyer(member.firmId, ctx.user.id);
    if (!timer) return null;
    return {
      ...timer,
      elapsedSeconds: elapsedSecondsFromTimer(timer),
    };
  }),

  startTimer: protectedProcedure
    .input(
      z.object({
        caseId: z.number(),
        description: z.string().optional().default(""),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmMember(ctx.user.id);
      if (!["admin", "lawyer", "assistant"].includes(member.firmRole)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const caseRow = await getCaseById(input.caseId, member.firmId);
      if (!caseRow) throw new TRPCError({ code: "NOT_FOUND", message: "Case not found" });

      const existing = await getActiveTimerForLawyer(member.firmId, ctx.user.id);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A timer is already running. Stop or save it first.",
        });
      }

      const id = await createActiveTimer({
        firmId: member.firmId,
        lawyerId: ctx.user.id,
        caseId: input.caseId,
        description: input.description || "",
        startedAt: new Date(),
        accumulatedSeconds: 0,
        isPaused: false,
        pausedAt: null,
      });
      return { id };
    }),

  pauseTimer: protectedProcedure.mutation(async ({ ctx }) => {
    const member = await requireFirmMember(ctx.user.id);
    const timer = await getActiveTimerForLawyer(member.firmId, ctx.user.id);
    if (!timer) throw new TRPCError({ code: "NOT_FOUND", message: "No active timer" });
    if (timer.isPaused) return { success: true };

    const elapsed = elapsedSecondsFromTimer(timer);
    await updateActiveTimer(timer.id, member.firmId, {
      accumulatedSeconds: elapsed,
      isPaused: true,
      pausedAt: new Date(),
      startedAt: timer.startedAt,
    });
    return { success: true, elapsedSeconds: elapsed };
  }),

  resumeTimer: protectedProcedure.mutation(async ({ ctx }) => {
    const member = await requireFirmMember(ctx.user.id);
    const timer = await getActiveTimerForLawyer(member.firmId, ctx.user.id);
    if (!timer) throw new TRPCError({ code: "NOT_FOUND", message: "No active timer" });
    if (!timer.isPaused) return { success: true };

    await updateActiveTimer(timer.id, member.firmId, {
      isPaused: false,
      pausedAt: null,
      startedAt: new Date(),
      accumulatedSeconds: timer.accumulatedSeconds,
    });
    return { success: true };
  }),

  updateTimer: protectedProcedure
    .input(
      z.object({
        caseId: z.number().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmMember(ctx.user.id);
      const timer = await getActiveTimerForLawyer(member.firmId, ctx.user.id);
      if (!timer) throw new TRPCError({ code: "NOT_FOUND", message: "No active timer" });
      if (input.caseId != null) {
        const caseRow = await getCaseById(input.caseId, member.firmId);
        if (!caseRow) throw new TRPCError({ code: "NOT_FOUND", message: "Case not found" });
      }
      await updateActiveTimer(timer.id, member.firmId, {
        caseId: input.caseId,
        description: input.description,
      });
      return { success: true };
    }),

  /** Stop timer and optionally save as a draft time entry. */
  stopTimer: protectedProcedure
    .input(
      z.object({
        save: z.boolean().default(true),
        description: z.string().optional(),
        billable: z.boolean().optional().default(true),
        /** Manual override of duration in minutes (optional) */
        durationMinutes: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmMember(ctx.user.id);
      const timer = await getActiveTimerForLawyer(member.firmId, ctx.user.id);
      if (!timer) throw new TRPCError({ code: "NOT_FOUND", message: "No active timer" });

      const elapsedSeconds = elapsedSecondsFromTimer(timer);
      const minutes =
        input.durationMinutes ??
        Math.max(1, Math.round(elapsedSeconds / 60));

      let entryId: number | null = null;
      if (input.save) {
        const rate = await getCurrentLawyerRate(member.firmId, ctx.user.id);
        entryId = await createTimeEntry({
          firmId: member.firmId,
          caseId: timer.caseId,
          lawyerId: ctx.user.id,
          description: input.description ?? timer.description ?? "Timed work",
          durationMinutes: minutes,
          hourlyRate: rate ? String(rate.hourlyRate) : null,
          billable: input.billable,
          status: "draft",
          date: new Date(),
          startTime: timer.startedAt,
          endTime: new Date(),
        });
      }

      await deleteActiveTimer(timer.id, member.firmId);
      return { success: true, entryId, durationMinutes: minutes, elapsedSeconds };
    }),

  discardTimer: protectedProcedure.mutation(async ({ ctx }) => {
    const member = await requireFirmMember(ctx.user.id);
    const timer = await getActiveTimerForLawyer(member.firmId, ctx.user.id);
    if (!timer) return { success: true };
    await deleteActiveTimer(timer.id, member.firmId);
    return { success: true };
  }),

  /** Create a draft invoice from billable time entries (draft or submitted). Drafts are auto-submitted. */
  createInvoiceFromEntries: protectedProcedure
    .input(
      z.object({
        entryIds: z.array(z.number()).min(1),
        clientId: z.number(),
        caseId: z.number().optional(),
        dueDate: z.number(),
        vatRate: z.number().default(7.7),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireFirmMember(ctx.user.id);
      if (!["admin", "lawyer"].includes(member.firmRole)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const rateRow = await getCurrentLawyerRate(member.firmId, ctx.user.id);
      const defaultRate = rateRow ? parseFloat(String(rateRow.hourlyRate)) : 0;

      const entries = [];
      for (const id of input.entryIds) {
        const entry = await getTimeEntryById(id, member.firmId);
        if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: `Entry ${id} not found` });
        if (!entry.billable) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Entry ${id} is not billable` });
        }
        if (entry.status === "billed") {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Entry ${id} is already billed` });
        }
        if (entry.status !== "draft" && entry.status !== "submitted") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Entry ${id} cannot be invoiced (status: ${entry.status})`,
          });
        }
        // Auto-submit drafts so billing can proceed in one step
        if (entry.status === "draft") {
          if (!canTransitionTimeEntryStatus("draft", "submitted")) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot submit entry ${id}` });
          }
          await updateTimeEntry(entry.id, member.firmId, { status: "submitted" });
          entry.status = "submitted";
        }
        entries.push(entry);
      }

      const caseId = input.caseId ?? entries[0]?.caseId;
      const items = entries.map((entry) => {
        const rate =
          entry.hourlyRate != null ? parseFloat(String(entry.hourlyRate)) : defaultRate;
        if (!rate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Set an hourly rate before invoicing time entries",
          });
        }
        const hours = minutesToHours(entry.durationMinutes);
        return {
          entryId: entry.id,
          description: entry.description,
          quantity: hours,
          unitPrice: rate,
          amount: computeTimeEntryAmount(entry.durationMinutes, rate),
        };
      });

      const subtotal = items.reduce((sum, i) => sum + i.amount, 0);
      const vatAmount = Math.round(subtotal * (input.vatRate / 100) * 100) / 100;
      const total = Math.round((subtotal + vatAmount) * 100) / 100;
      const invoiceNumber = await getNextInvoiceNumber(member.firmId);
      const firm = await getFirmById(member.firmId);
      const currency = normalizeCurrency(firm?.defaultCurrency || DEFAULT_CURRENCY);

      await createInvoice({
        firmId: member.firmId,
        clientId: input.clientId,
        caseId,
        invoiceNumber,
        dueDate: new Date(input.dueDate),
        vatRate: String(input.vatRate),
        vatAmount: String(vatAmount.toFixed(2)),
        subtotal: String(subtotal.toFixed(2)),
        total: String(total.toFixed(2)),
        currency,
        notes: input.notes,
        createdByUserId: ctx.user.id,
        status: "draft",
      });

      const allInvoices = await getInvoicesByFirm(member.firmId);
      const newInvoice = allInvoices[0]?.invoice;
      if (!newInvoice) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemId = await createInvoiceItem({
          invoiceId: newInvoice.id,
          description: item.description,
          billingType: "hourly",
          quantity: String(item.quantity.toFixed(2)),
          unitPrice: String(item.unitPrice.toFixed(2)),
          amount: String(item.amount.toFixed(2)),
          sortOrder: i,
        });
        await updateTimeEntry(item.entryId, member.firmId, {
          status: "billed",
          invoiceItemId: itemId || null,
        });
      }

      return newInvoice;
    }),
});
