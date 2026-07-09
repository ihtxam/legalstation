import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createMessage,
  getFirmMemberByUserId,
  getMessagesByCase,
  getUnreadMessageCount,
  markMessageRead,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

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
      if (!member) throw new TRPCError({ code: "UNAUTHORIZED" });
      await createMessage({
        caseId: input.caseId,
        firmId: member.firmId,
        senderUserId: ctx.user.id,
        content: input.content,
        parentMessageId: input.parentMessageId,
      });
      return { success: true };
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
