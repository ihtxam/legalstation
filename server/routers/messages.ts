import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { sendMessageNotificationEmail } from "../email";
import {
  createMessage,
  getFirmMemberByUserId,
  getMessagesByCase,
  getUnreadMessageCount,
  markMessageRead,
  getClientByUserId,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { getCaseNotificationRecipients } from "../caseNotifications";

export const messagesRouter = router({
  list: protectedProcedure
    .input(z.object({ caseId: z.number() }))
    .query(async ({ ctx, input }) => {
      return getMessagesByCase(input.caseId);
    }),

  send: protectedProcedure
    .input(z.object({
      caseId: z.number(),
      content: z.string().min(1).max(10000),
      parentMessageId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await getFirmMemberByUserId(ctx.user.id);
      const client = member ? null : await getClientByUserId(ctx.user.id);
      if (!member && !client) throw new TRPCError({ code: "UNAUTHORIZED" });

      const firmId = member?.firmId ?? client!.firmId;
      await createMessage({
        caseId: input.caseId,
        firmId,
        senderUserId: ctx.user.id,
        content: input.content,
        parentMessageId: input.parentMessageId,
      });

      const { caseTitle, recipients } = await getCaseNotificationRecipients(
        input.caseId,
        ctx.user.id
      );
      const origin = String(ctx.req.headers.origin || "");
      const caseUrl = `${origin}/cases/${input.caseId}`;
      const preview = input.content.substring(0, 100);
      const senderName = ctx.user.name || "A colleague";

      await Promise.allSettled(
        recipients.map((r) =>
          sendMessageNotificationEmail(
            r.email,
            senderName,
            caseTitle,
            preview,
            caseUrl
          )
        )
      );

      return { success: true, notified: recipients.length };
    }),

  markRead: protectedProcedure
    .input(z.object({ messageId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await markMessageRead({ messageId: input.messageId, userId: ctx.user.id });
      return { success: true };
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const member = await getFirmMemberByUserId(ctx.user.id);
    if (!member) return 0;
    return getUnreadMessageCount(ctx.user.id, member.firmId);
  }),
});
