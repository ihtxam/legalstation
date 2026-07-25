import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { publicProcedure, router, superadminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { platformLeads, agencySettings, users } from "../../drizzle/schema";
import { sendLeadNotificationEmail } from "../email";

export const leadsRouter = router({
  submit: publicProcedure
    .input(
      z.object({
        type: z.enum(["demo", "signup"]),
        firmName: z.string().min(2).max(255),
        contactName: z.string().min(2).max(200),
        email: z.string().email(),
        phone: z.string().max(50).optional(),
        message: z.string().max(5000).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.insert(platformLeads).values({
        type: input.type,
        firmName: input.firmName,
        contactName: input.contactName,
        email: input.email.toLowerCase(),
        phone: input.phone,
        message: input.message,
        status: "new",
      });

      // Notify platform support email, else first superadmin
      let notifyTo: string | null = null;
      try {
        const [row] = await db
          .select()
          .from(agencySettings)
          .where(eq(agencySettings.key, "support_email"))
          .limit(1);
        notifyTo = row?.value || null;
      } catch {
        /* ignore */
      }
      if (!notifyTo) {
        const [admin] = await db
          .select()
          .from(users)
          .where(eq(users.role, "superadmin"))
          .limit(1);
        notifyTo = admin?.email || null;
      }
      if (notifyTo) {
        await sendLeadNotificationEmail({
          toEmail: notifyTo,
          type: input.type,
          firmName: input.firmName,
          contactName: input.contactName,
          email: input.email,
          phone: input.phone,
          message: input.message,
        }).catch((err) => console.error("[Email] lead notify:", err.message));
      }

      return { success: true };
    }),

  list: superadminProcedure
    .input(
      z
        .object({
          type: z.enum(["demo", "signup"]).optional(),
          status: z.enum(["new", "contacted", "qualified", "closed"]).optional(),
          limit: z.number().int().min(1).max(200).default(100),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      let rows = await db
        .select()
        .from(platformLeads)
        .orderBy(desc(platformLeads.createdAt))
        .limit(input?.limit ?? 100);
      if (input?.type) rows = rows.filter((r) => r.type === input.type);
      if (input?.status) rows = rows.filter((r) => r.status === input.status);
      return rows;
    }),

  updateStatus: superadminProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["new", "contacted", "qualified", "closed"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(platformLeads)
        .set({ status: input.status })
        .where(eq(platformLeads.id, input.id));
      return { success: true };
    }),
});
