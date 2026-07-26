import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { TRPC_URL } from "../config";
import { getSessionToken } from "../auth/session";

/**
 * Untyped proxy matching Cliavo `server/routers.ts`.
 * Cast to any: passing `any`/`AnyRouter` into createTRPCReact triggers
 * tRPC's built-in name-collision error type.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const trpc: any = createTRPCReact();

export function createTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: TRPC_URL,
        transformer: superjson,
        async headers() {
          const token = await getSessionToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}
