import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  createDocumentSummary,
  getDocumentSummary,
  markAnalysisInProgress,
  markAnalysisCompleted,
  markAnalysisFailed,
} from "../db.documentAnalysis";
import { invokeLLM } from "../_core/llm";
import {
  extractDocumentContent,
  parseAnalysisResponse,
} from "../documentContent";

export const documentAnalysisRouter = router({
  getSummary: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ input }) => {
      return getDocumentSummary(input.documentId);
    }),

  analyzeDocument: protectedProcedure
    .input(
      z.object({
        documentId: z.number(),
        documentUrl: z.string(),
        fileName: z.string(),
        mimeType: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        await createDocumentSummary({
          documentId: input.documentId,
          status: "analyzing",
        });
        await markAnalysisInProgress(input.documentId);

        let buffer: Buffer | undefined;
        try {
          const response = await fetch(input.documentUrl);
          if (response.ok) {
            buffer = Buffer.from(await response.arrayBuffer());
          }
        } catch (error) {
          console.error("Failed to fetch document:", error);
        }

        const extracted = await extractDocumentContent({
          mimeType: input.mimeType,
          fileName: input.fileName,
          buffer,
          fallbackText: `Document: ${input.fileName}`,
        });

        const contentPreview = extracted.text;
        const analysisPrompt = `Analyze the following document and provide:
1. A concise summary (2-3 sentences)
2. Key points (3-5 bullet points)
3. Sentiment (positive, neutral, or negative)
4. Document type (contract, agreement, letter, report, etc.)
5. Estimated reading time in minutes

Document Name: ${input.fileName}
Document Kind: ${extracted.kind}
Document Content:
${contentPreview}

Respond in JSON format with keys: summary, keyPoints (array), sentiment, documentType, readingTime, entities (array of important names/dates/amounts)`;

        const response = await invokeLLM({
          messages: [
            {
              role: "user",
              content: analysisPrompt,
            },
          ],
          model: "gpt-4o-mini",
          maxTokens: 1000,
        });

        let analysis = parseAnalysisResponse("", contentPreview);
        try {
          const choice = response.choices?.[0];
          const messageContent = choice?.message?.content;
          const textContent = typeof messageContent === "string" ? messageContent : "";
          analysis = parseAnalysisResponse(textContent, contentPreview);
          // Prefer extracted word count
          analysis.wordCount = extracted.wordCount || analysis.wordCount;
        } catch (parseError) {
          console.error("Failed to parse LLM response:", parseError);
        }

        await markAnalysisCompleted(input.documentId, analysis);

        return {
          success: true,
          summary: analysis,
          extracted: {
            kind: extracted.kind,
            truncated: extracted.truncated,
            wordCount: extracted.wordCount,
          },
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        await markAnalysisFailed(input.documentId, errorMessage);
        throw error;
      }
    }),
});
