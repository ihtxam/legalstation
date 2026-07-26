import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { deploymentPublicInfo } from "../deployment";
import { evaluateLicense } from "../license";
import {
  exportDocumentAuditLog,
  getFirmMemberByUserId,
} from "../db";

export const deploymentRouter = router({
  info: publicProcedure.query(() => deploymentPublicInfo()),

  licenseStatus: protectedProcedure.query(() => evaluateLicense()),

  /** SIEM-friendly audit export (JSON lines-ready array). */
  exportAuditLog: protectedProcedure
    .input(
      z
        .object({
          from: z.string().optional(),
          to: z.string().optional(),
          limit: z.number().int().min(1).max(5000).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      if (!member) throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
      const { getFirmCapabilityMatrix } = await import("../firmPermissions");
      const { canAccessAdminConsole } = await import("@shared/roles");
      const { matrix } = await getFirmCapabilityMatrix(member.firmId);
      if (!canAccessAdminConsole(member.firmRole, matrix)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
      }

      const rows = await exportDocumentAuditLog({
        firmId: member.firmId,
        from: input?.from ? new Date(input.from) : undefined,
        to: input?.to ? new Date(input.to) : undefined,
        limit: input?.limit,
      });

      return {
        format: "cliavo.audit.v1",
        exportedAt: new Date().toISOString(),
        firmId: member.firmId,
        count: rows.length,
        events: rows.map((r) => ({
          event_id: r.id,
          event_type: `document.${r.action}`,
          timestamp: r.createdAt,
          actor_user_id: r.userId,
          resource: {
            type: "document",
            id: r.documentId,
            name: r.documentName,
            case_id: r.caseId,
          },
          network: {
            ip: r.ipAddress,
            user_agent: r.userAgent,
          },
        })),
      };
    }),
});
