import {
  DEFAULT_ALLOWED_UPLOAD_EXTENSIONS,
  resolveUploadPolicy,
  type UploadPolicy,
} from "@shared/uploadPolicy";
import { getFirmById, getFirmMemberByUserId, getDb } from "./db";
import { clients } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { sdk } from "./_core/sdk";
import type { Request } from "express";

export async function resolveFirmUploadPolicyForUser(userId: number): Promise<UploadPolicy> {
  const member = await getFirmMemberByUserId(userId);
  if (member) {
    const firm = await getFirmById(member.firmId);
    if (firm) {
      return resolveUploadPolicy({
        maxUploadBytes: firm.maxUploadBytes,
        allowedUploadTypes: firm.allowedUploadTypes,
      });
    }
  }

  const db = await getDb();
  if (db) {
    const [client] = await db
      .select({ firmId: clients.firmId })
      .from(clients)
      .where(eq(clients.userId, userId))
      .limit(1);
    if (client) {
      const firm = await getFirmById(client.firmId);
      if (firm) {
        return resolveUploadPolicy({
          maxUploadBytes: firm.maxUploadBytes,
          allowedUploadTypes: firm.allowedUploadTypes,
        });
      }
    }
  }

  return resolveUploadPolicy();
}

export async function resolveUploadPolicyFromRequest(req: Request): Promise<UploadPolicy> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user?.id) return resolveFirmUploadPolicyForUser(user.id);
  } catch {
    // fall through to defaults
  }
  return resolveUploadPolicy({
    maxUploadBytes: undefined,
    allowedUploadTypes: JSON.stringify([...DEFAULT_ALLOWED_UPLOAD_EXTENSIONS]),
  });
}
