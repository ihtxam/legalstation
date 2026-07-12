import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb, getInvoiceById } from "../db";
import { generateInvoicePdf } from "../invoicePdf";

export const invoicePdfRouter = router({
  // ─── Generate Invoice PDF ───────────────────────────────────────────────────
  generate: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await getInvoiceById(input.invoiceId, 0);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });

      // TODO: Fetch firm, client, case details and generate PDF
      // For now, return a placeholder

      return {
        success: true,
        message: "PDF generation not yet implemented",
      };
    }),
});
