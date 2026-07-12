import { COOKIE_NAME } from "@shared/const";
import { invoicePdfRouter } from "./routers/invoicePdfRouter";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
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

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
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
});

export type AppRouter = typeof appRouter;
