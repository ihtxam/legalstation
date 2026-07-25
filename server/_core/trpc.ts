import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { TrpcContext } from "./context";

function friendlyZodMessage(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid input";
  if (issue.message && !issue.message.startsWith("Too small") && !issue.message.startsWith("Invalid input")) {
    return issue.message;
  }
  const field = issue.path.length ? String(issue.path[issue.path.length - 1]) : "field";
  if (issue.code === "too_small") {
    return `Please provide a valid ${field}.`;
  }
  return issue.message || `Invalid ${field}`;
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const cause = error.cause;
    if (cause instanceof ZodError) {
      return {
        ...shape,
        message: friendlyZodMessage(cause),
        data: {
          ...shape.data,
          zodError: cause.flatten(),
        },
      };
    }
    // tRPC may already stringify Zod issues into error.message
    if (typeof shape.message === "string" && shape.message.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(shape.message) as Array<{ message?: string; path?: Array<string | number>; code?: string }>;
        if (Array.isArray(parsed) && parsed[0]?.message) {
          const issue = parsed[0];
          const field = issue.path?.length ? String(issue.path[issue.path.length - 1]) : "field";
          const message =
            issue.message && !issue.message.startsWith("Too small")
              ? issue.message
              : issue.code === "too_small"
                ? `Please provide a valid ${field}.`
                : issue.message;
          return { ...shape, message };
        }
      } catch {
        // keep original
      }
    }
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

export const superadminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== "superadmin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Superadmin access required. Sign in at /platform/login.",
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
