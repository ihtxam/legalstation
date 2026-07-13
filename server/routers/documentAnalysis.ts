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

export const documentAnalysisRouter = router<any>({
  // Get document summary
  getSummary: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ input }) => {
      const summary = await getDocumentSummary(input.documentId);
      return summary;
    }),

  // Trigger document analysis (called after document upload)
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
        // Create initial summary record
        await createDocumentSummary({
          documentId: input.documentId,
          status: "analyzing",
        });

        // Mark as analyzing
        await markAnalysisInProgress(input.documentId);

        // Fetch document content
        let documentContent = "";
        try {
          const response = await fetch(input.documentUrl);
          if (response.ok) {
            // For text-based files, get text content
            if (
              input.mimeType.includes("text") ||
              input.mimeType.includes("json") ||
              input.mimeType.includes("xml")
            ) {
              documentContent = await response.text();
            } else if (input.mimeType.includes("pdf")) {
              // For PDFs, we would need a PDF parser - for now, use filename as context
              documentContent = `PDF Document: ${input.fileName}`;
            } else {
              documentContent = `Document: ${input.fileName}`;
            }
          }
        } catch (error) {
          console.error("Failed to fetch document:", error);
          documentContent = `Document: ${input.fileName}`;
        }

        // Limit content to first 8000 characters to avoid token limits
        const contentPreview = documentContent.substring(0, 8000);

        // Call LLM to analyze document
        const analysisPrompt = `Analyze the following document and provide:
1. A concise summary (2-3 sentences)
2. Key points (3-5 bullet points)
3. Sentiment (positive, neutral, or negative)
4. Document type (contract, agreement, letter, report, etc.)
5. Estimated reading time in minutes

Document Name: ${input.fileName}
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
          max_tokens: 1000,
        });

        // Parse LLM response
        let analysis: any = {
          summary: "Unable to analyze document",
          keyPoints: [],
          sentiment: "neutral",
          documentType: "document",
          wordCount: contentPreview.split(/\s+/).length,
          readingTime: Math.ceil(contentPreview.split(/\s+/).length / 200),
          extractedEntities: [],
        };

        try {
          const choice = response.choices[0];
          if (choice && choice.message) {
            const messageContent = choice.message.content;
            const textContent = typeof messageContent === "string" ? messageContent : "";
            
            // Extract JSON from response
            const jsonMatch = textContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              analysis = {
                summary: parsed.summary || analysis.summary,
                keyPoints: parsed.keyPoints || [],
                sentiment: parsed.sentiment || "neutral",
                documentType: parsed.documentType || "document",
                wordCount: contentPreview.split(/\s+/).length,
                readingTime: parsed.readingTime || Math.ceil(contentPreview.split(/\s+/).length / 200),
                extractedEntities: parsed.entities || [],
              };
            }
          }
        } catch (parseError) {
          console.error("Failed to parse LLM response:", parseError);
        }

        // Save completed analysis
        await markAnalysisCompleted(input.documentId, analysis);

        return {
          success: true,
          summary: analysis,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        await markAnalysisFailed(input.documentId, errorMessage);
        throw error;
      }
    }),


});
