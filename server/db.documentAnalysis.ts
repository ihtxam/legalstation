import { getDb } from "./db";
import { documentSummaries } from "../drizzle/schema";
import { eq } from "drizzle-orm";

export async function createDocumentSummary(data: {
  documentId: number;
  status?: "pending" | "analyzing" | "completed" | "failed";
  error?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  
  const result = await db.insert(documentSummaries).values({
    documentId: data.documentId,
    status: data.status || "pending",
    error: data.error,
  });
  return result;
}

export async function getDocumentSummary(documentId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(documentSummaries)
    .where(eq(documentSummaries.documentId, documentId))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function updateDocumentSummary(
  documentId: number,
  data: {
    summary?: string;
    keyPoints?: string; // JSON stringified array
    sentiment?: string;
    documentType?: string;
    wordCount?: number;
    readingTime?: number;
    extractedEntities?: string; // JSON stringified array
    status?: "pending" | "analyzing" | "completed" | "failed";
    error?: string;
    analyzedAt?: Date;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  
  const result = await db
    .update(documentSummaries)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(documentSummaries.documentId, documentId));
  
  return result;
}

export async function markAnalysisInProgress(documentId: number) {
  return updateDocumentSummary(documentId, {
    status: "analyzing",
  });
}

export async function markAnalysisCompleted(
  documentId: number,
  analysis: {
    summary: string;
    keyPoints: string[];
    sentiment: string;
    documentType: string;
    wordCount: number;
    readingTime: number;
    extractedEntities: any[];
  }
) {
  return updateDocumentSummary(documentId, {
    summary: analysis.summary,
    keyPoints: JSON.stringify(analysis.keyPoints),
    sentiment: analysis.sentiment,
    documentType: analysis.documentType,
    wordCount: analysis.wordCount,
    readingTime: analysis.readingTime,
    extractedEntities: JSON.stringify(analysis.extractedEntities),
    status: "completed",
    analyzedAt: new Date(),
  });
}

export async function markAnalysisFailed(documentId: number, error: string) {
  return updateDocumentSummary(documentId, {
    status: "failed",
    error,
  });
}
