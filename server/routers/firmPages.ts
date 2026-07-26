import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, asc, eq, ne } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb, getFirmBySlug, getFirmMemberByUserId } from "../db";
import { firmPages, firms } from "../../drizzle/schema";
import { firmPublicSiteUrls, resolveFirmFromHost } from "../tenant";

async function requireAdmin(userId: number) {
  const member = await getFirmMemberByUserId(userId);
  if (!member) throw new TRPCError({ code: "UNAUTHORIZED" });
  const { getFirmCapabilityMatrix } = await import("../firmPermissions");
  const { canAccessAdminConsole } = await import("@shared/roles");
  const { matrix } = await getFirmCapabilityMatrix(member.firmId);
  if (!canAccessAdminConsole(member.firmRole, matrix)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
  }
  return member;
}

async function requireStaff(userId: number) {
  const member = await getFirmMemberByUserId(userId);
  if (!member || !["admin", "subadmin", "lawyer", "assistant"].includes(member.firmRole)) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return member;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "page";
}

export const firmPagesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const member = await requireStaff(ctx.user.id);
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(firmPages)
      .where(eq(firmPages.firmId, member.firmId))
      .orderBy(asc(firmPages.title));
  }),

  get: protectedProcedure
    .input(
      z
        .object({
          id: z.number().optional(),
          slug: z.string().optional(),
        })
        .refine((v) => v.id != null || !!v.slug, { message: "id or slug required" })
    )
    .query(async ({ ctx, input }) => {
      const member = await requireStaff(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [page] = await db
        .select()
        .from(firmPages)
        .where(
          and(
            eq(firmPages.firmId, member.firmId),
            input.id != null
              ? eq(firmPages.id, input.id)
              : eq(firmPages.slug, input.slug!)
          )
        )
        .limit(1);

      if (!page) throw new TRPCError({ code: "NOT_FOUND" });
      return page;
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        slug: z.string().max(120).optional(),
        content: z.string().optional(),
        published: z.boolean().optional(),
        isHome: z.boolean().optional(),
        seoTitle: z.string().max(255).optional().nullable(),
        seoDescription: z.string().max(500).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const slug = slugify(input.slug || input.title);
      const [existing] = await db
        .select({ id: firmPages.id })
        .from(firmPages)
        .where(and(eq(firmPages.firmId, member.firmId), eq(firmPages.slug, slug)))
        .limit(1);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Slug already exists" });
      }

      if (input.isHome) {
        await db
          .update(firmPages)
          .set({ isHome: false })
          .where(eq(firmPages.firmId, member.firmId));
      }

      const [result] = await db.insert(firmPages).values({
        firmId: member.firmId,
        title: input.title,
        slug,
        content: input.content ?? null,
        published: input.published ?? false,
        isHome: input.isHome ?? false,
        seoTitle: input.seoTitle ?? null,
        seoDescription: input.seoDescription ?? null,
        createdByUserId: ctx.user.id,
      });

      return { id: Number((result as { insertId?: number }).insertId ?? 0), slug };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        slug: z.string().max(120).optional(),
        content: z.string().optional().nullable(),
        published: z.boolean().optional(),
        isHome: z.boolean().optional(),
        seoTitle: z.string().max(255).optional().nullable(),
        seoDescription: z.string().max(500).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [page] = await db
        .select()
        .from(firmPages)
        .where(and(eq(firmPages.id, input.id), eq(firmPages.firmId, member.firmId)))
        .limit(1);
      if (!page) throw new TRPCError({ code: "NOT_FOUND" });

      if (input.slug && input.slug !== page.slug) {
        const slug = slugify(input.slug);
        const [clash] = await db
          .select({ id: firmPages.id })
          .from(firmPages)
          .where(
            and(
              eq(firmPages.firmId, member.firmId),
              eq(firmPages.slug, slug),
              ne(firmPages.id, input.id)
            )
          )
          .limit(1);
        if (clash) throw new TRPCError({ code: "CONFLICT", message: "Slug already exists" });
        input.slug = slug;
      }

      if (input.isHome) {
        await db
          .update(firmPages)
          .set({ isHome: false })
          .where(and(eq(firmPages.firmId, member.firmId), ne(firmPages.id, input.id)));
      }

      const { id, ...data } = input;
      await db
        .update(firmPages)
        .set({
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.slug !== undefined ? { slug: data.slug } : {}),
          ...(data.content !== undefined ? { content: data.content } : {}),
          ...(data.published !== undefined ? { published: data.published } : {}),
          ...(data.isHome !== undefined ? { isHome: data.isHome } : {}),
          ...(data.seoTitle !== undefined ? { seoTitle: data.seoTitle } : {}),
          ...(data.seoDescription !== undefined
            ? { seoDescription: data.seoDescription }
            : {}),
        })
        .where(eq(firmPages.id, id));

      return { success: true as const };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const member = await requireAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [page] = await db
        .select()
        .from(firmPages)
        .where(and(eq(firmPages.id, input.id), eq(firmPages.firmId, member.firmId)))
        .limit(1);
      if (!page) throw new TRPCError({ code: "NOT_FOUND" });

      await db.delete(firmPages).where(eq(firmPages.id, input.id));
      return { success: true as const };
    }),

  setHome: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const member = await requireAdmin(ctx.user.id);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [page] = await db
        .select()
        .from(firmPages)
        .where(and(eq(firmPages.id, input.id), eq(firmPages.firmId, member.firmId)))
        .limit(1);
      if (!page) throw new TRPCError({ code: "NOT_FOUND" });

      await db
        .update(firmPages)
        .set({ isHome: false })
        .where(eq(firmPages.firmId, member.firmId));
      await db.update(firmPages).set({ isHome: true }).where(eq(firmPages.id, input.id));

      return { success: true as const };
    }),

  /** Public URL helpers for the CMS admin UI. */
  publicUrls: protectedProcedure.query(async ({ ctx }) => {
    const member = await requireStaff(ctx.user.id);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [firm] = await db.select().from(firms).where(eq(firms.id, member.firmId)).limit(1);
    if (!firm) throw new TRPCError({ code: "NOT_FOUND" });
    const urls = firmPublicSiteUrls(firm, ctx.req);
    return {
      firmName: firm.name,
      slug: firm.slug,
      customDomain: firm.customDomain,
      subdomainStatus: firm.subdomainStatus,
      ...urls,
    };
  }),

  /**
   * Public firm website page (no auth).
   * Resolve by firmSlug path, or by Host (subdomain / custom domain).
   */
  publicPage: publicProcedure
    .input(
      z.object({
        firmSlug: z.string().min(1).max(80).optional(),
        pageSlug: z.string().min(1).max(120).optional(),
        /** When true, return homepage (isHome) for the firm */
        home: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      let firm =
        (input.firmSlug
          ? await getFirmBySlug(input.firmSlug.trim().toLowerCase())
          : null) || (await resolveFirmFromHost(ctx.req));

      if (!firm) throw new TRPCError({ code: "NOT_FOUND", message: "Firm site not found" });

      let page = null as typeof firmPages.$inferSelect | null;
      if (input.home || !input.pageSlug) {
        const [home] = await db
          .select()
          .from(firmPages)
          .where(
            and(
              eq(firmPages.firmId, firm.id),
              eq(firmPages.published, true),
              eq(firmPages.isHome, true)
            )
          )
          .limit(1);
        page = home || null;
        if (!page) {
          const [first] = await db
            .select()
            .from(firmPages)
            .where(and(eq(firmPages.firmId, firm.id), eq(firmPages.published, true)))
            .orderBy(asc(firmPages.title))
            .limit(1);
          page = first || null;
        }
      } else {
        const [bySlug] = await db
          .select()
          .from(firmPages)
          .where(
            and(
              eq(firmPages.firmId, firm.id),
              eq(firmPages.slug, input.pageSlug),
              eq(firmPages.published, true)
            )
          )
          .limit(1);
        page = bySlug || null;
      }

      if (!page) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Page not found or not published" });
      }

      const nav = await db
        .select({
          slug: firmPages.slug,
          title: firmPages.title,
          isHome: firmPages.isHome,
        })
        .from(firmPages)
        .where(and(eq(firmPages.firmId, firm.id), eq(firmPages.published, true)))
        .orderBy(asc(firmPages.title));

      const urls = firmPublicSiteUrls(firm, ctx.req);

      return {
        firm: {
          name: firm.name,
          slug: firm.slug,
          logoUrl: firm.logoUrl,
          primaryColor: firm.primaryColor || "#00BFA6",
          secondaryColor: firm.secondaryColor,
          email: firm.email,
          phone: firm.phone,
          address: firm.address,
          website: firm.website,
        },
        page: {
          id: page.id,
          slug: page.slug,
          title: page.title,
          content: page.content,
          isHome: page.isHome,
          seoTitle: page.seoTitle,
          seoDescription: page.seoDescription,
        },
        nav,
        urls: {
          home: urls.preferredHome,
          pathHome: urls.pathHome,
          subdomainHome: urls.subdomainHome,
          customHome: urls.customHome,
        },
      };
    }),
});
