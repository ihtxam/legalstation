import { COOKIE_NAME, IMPERSONATOR_COOKIE } from "@shared/const";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { invoicePdfRouter } from "./routers/invoicePdfRouter";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb, getFirmMemberByUserId } from "./db";
import { firms } from "../drizzle/schema";
import {
  getImpersonatorSessionToken,
  stopImpersonationSession,
} from "./impersonation";
import { sdk } from "./_core/sdk";
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
import { timeEntriesRouter } from "./routers/timeEntries";
import { documentRequestsRouter } from "./routers/documentRequests";
import { leadsRouter } from "./routers/leads";
import { deploymentRouter } from "./routers/deployment";
import { matterStagesRouter } from "./routers/matterStages";
import { caseTasksRouter } from "./routers/caseTasks";
import { clientActivitiesRouter } from "./routers/clientActivities";
import { firmLeadsRouter } from "./routers/firmLeads";
import { firmPagesRouter } from "./routers/firmPages";
import { calendarRouter } from "./routers/calendar";
import { clientPackagesRouter } from "./routers/clientPackages";
import { ondemandServicesRouter } from "./routers/ondemandServices";
import { signupRouter } from "./routers/signup";
import { announcementsRouter } from "./routers/announcements";
import { supportTicketsRouter } from "./routers/supportTickets";
import { updateUserById } from "./db";
import {
  TWO_FACTOR_COOKIE,
  TWO_FACTOR_TTL_MS,
  generateTotpSecret,
  signTwoFactorOk,
  verifyTotpCode,
  verifyTwoFactorOk,
} from "./totp";
import QRCode from "qrcode";

export const appRouter = router({
  system: systemRouter,
  deployment: deploymentRouter,
  auth: router({
    me: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return null;
      const rawCookie = ctx.req.headers.cookie || "";
      const cookie = rawCookie
        .split(";")
        .map((p) => p.trim())
        .find((p) => p.startsWith(`${TWO_FACTOR_COOKIE}=`))
        ?.split("=")
        .slice(1)
        .join("=");
      const totpEnabled = Boolean(ctx.user.totpEnabled);

      let impersonation: {
        active: true;
        firmId: number;
        firmName: string;
        adminEmail: string | null;
        adminName: string | null;
      } | null = null;

      const impersonatorToken = getImpersonatorSessionToken(ctx.req);
      if (impersonatorToken) {
        const original = await sdk.verifySession(impersonatorToken);
        if (original) {
          const member = await getFirmMemberByUserId(ctx.user.id);
          if (member) {
            const db = await getDb();
            const [firm] = db
              ? await db.select().from(firms).where(eq(firms.id, member.firmId)).limit(1)
              : [];
            if (firm) {
              impersonation = {
                active: true,
                firmId: firm.id,
                firmName: firm.name,
                adminEmail: ctx.user.email,
                adminName: ctx.user.name,
              };
            }
          }
        }
      }

      // Impersonation bypasses 2FA and forced password change for the target account
      const requires2fa =
        !impersonation && totpEnabled && !verifyTwoFactorOk(cookie, ctx.user.id);
      return {
        id: ctx.user.id,
        openId: ctx.user.openId,
        name: ctx.user.name,
        email: ctx.user.email,
        loginMethod: ctx.user.loginMethod,
        role: ctx.user.role,
        preferredLocale: ctx.user.preferredLocale || "en",
        mustChangePassword: impersonation ? false : Boolean(ctx.user.mustChangePassword),
        totpEnabled,
        requires2fa,
        impersonation,
        createdAt: ctx.user.createdAt,
        lastSignedIn: ctx.user.lastSignedIn,
      };
    }),
    stopImpersonation: protectedProcedure.mutation(async ({ ctx }) => {
      const result = await stopImpersonationSession(ctx.req, ctx.res);
      if (!result.restored) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active impersonation session",
        });
      }
      return { success: true as const, redirectTo: "/superadmin" as const };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie(TWO_FACTOR_COOKIE, { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie(IMPERSONATOR_COOKIE, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    setupTotp: protectedProcedure.mutation(async ({ ctx }) => {
      const account = ctx.user.email || ctx.user.name || `user-${ctx.user.id}`;
      const { secret, otpauthUrl } = generateTotpSecret(account);
      await updateUserById(ctx.user.id, { totpSecret: secret, totpEnabled: false });
      const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
      return { secret, otpauthUrl, qrDataUrl };
    }),
    enableTotp: protectedProcedure
      .input(z.object({ code: z.string().min(6).max(8) }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.totpSecret) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Call setupTotp first" });
        }
        if (!verifyTotpCode(ctx.user.totpSecret, input.code)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid authenticator code" });
        }
        await updateUserById(ctx.user.id, { totpEnabled: true });
        const expires = Date.now() + TWO_FACTOR_TTL_MS;
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(TWO_FACTOR_COOKIE, signTwoFactorOk(ctx.user.id, expires), {
          ...cookieOptions,
          maxAge: TWO_FACTOR_TTL_MS,
        });
        return { success: true as const };
      }),
    disableTotp: protectedProcedure
      .input(z.object({ code: z.string().min(6).max(8) }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.totpEnabled || !ctx.user.totpSecret) {
          return { success: true as const };
        }
        if (!verifyTotpCode(ctx.user.totpSecret, input.code)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid authenticator code" });
        }
        await updateUserById(ctx.user.id, { totpEnabled: false, totpSecret: null });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.clearCookie(TWO_FACTOR_COOKIE, { ...cookieOptions, maxAge: -1 });
        return { success: true as const };
      }),
    verifyTotp: protectedProcedure
      .input(z.object({ code: z.string().min(6).max(8) }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.totpEnabled || !ctx.user.totpSecret) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "2FA is not enabled" });
        }
        if (!verifyTotpCode(ctx.user.totpSecret, input.code)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid authenticator code" });
        }
        const expires = Date.now() + TWO_FACTOR_TTL_MS;
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(TWO_FACTOR_COOKIE, signTwoFactorOk(ctx.user.id, expires), {
          ...cookieOptions,
          maxAge: TWO_FACTOR_TTL_MS,
        });
        return { success: true as const };
      }),
    setLocale: protectedProcedure
      .input(z.object({ locale: z.enum(["en", "fr", "de", "it", "ar"]) }))
      .mutation(async ({ ctx, input }) => {
        await updateUserById(ctx.user.id, { preferredLocale: input.locale });
        return { success: true as const, locale: input.locale };
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
  invoicePdf: invoicePdfRouter,
  timeEntries: timeEntriesRouter,
  documentRequests: documentRequestsRouter,
  leads: leadsRouter,
  signup: signupRouter,
  matterStages: matterStagesRouter,
  caseTasks: caseTasksRouter,
  clientActivities: clientActivitiesRouter,
  firmLeads: firmLeadsRouter,
  firmPages: firmPagesRouter,
  calendar: calendarRouter,
  clientPackages: clientPackagesRouter,
  ondemandServices: ondemandServicesRouter,
  announcements: announcementsRouter,
  supportTickets: supportTicketsRouter,
});

export type AppRouter = typeof appRouter;
