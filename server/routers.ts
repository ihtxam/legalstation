import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { invoicePdfRouter } from "./routers/invoicePdfRouter";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { firmRouter } from "./routers/firm";
import { clientsRouter } from "./routers/clients";
import { casesRouter } from "./routers/cases";
import { documentsRouter } from "./routers/documents";
import { messagesRouter } from "./routers/messages";
import { invoicesRouter } from "./routers/invoices";
import { dashboardRouter } from "./routers/dashboard";
import { stripeRouter } from "./routers/stripe";
import { superadminRouter } from "./routers/superadmin";
import { paymentPlansRouter } from "./routers/paymentPlans";
import { settingsRouter } from "./routers/settings";
import { adyenRouter } from "./routers/adyen";
import { documentAnalysisRouter } from "./routers/documentAnalysis";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    devLoginEnabled: publicProcedure.query(() => ENV.enableDevLogin),
    /** Dev/test login for cloud & on-prem smoke tests (disabled when OAuth is configured unless ENABLE_DEV_LOGIN=true). */
    devLogin: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          name: z.string().min(1).max(120).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (!ENV.enableDevLogin) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Dev login is disabled" });
        }
        if (!ENV.appId || !ENV.cookieSecret) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "VITE_APP_ID and JWT_SECRET are required for dev login",
          });
        }

        const openId = `dev:${input.email.toLowerCase()}`;
        const name = input.name ?? input.email.split("@")[0] ?? "Dev User";
        await db.upsertUser({
          openId,
          email: input.email.toLowerCase(),
          name,
          loginMethod: "dev",
          lastSignedIn: new Date(),
        });

        const sessionToken = await sdk.createSessionToken(openId, {
          name,
          expiresInMs: ONE_YEAR_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        return { success: true as const, openId };
      }),
  }),
  firm: firmRouter,
  clients: clientsRouter,
  cases: casesRouter,
  documents: documentsRouter,
  messages: messagesRouter,
  invoices: invoicesRouter,
  dashboard: dashboardRouter,
  stripe: stripeRouter,
  superadmin: superadminRouter,
  paymentPlans: paymentPlansRouter,
  settings: settingsRouter,
  adyen: adyenRouter,
  documentAnalysis: documentAnalysisRouter,
});

export type AppRouter = typeof appRouter;
