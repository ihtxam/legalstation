import JSZip from "jszip";

export type ExtractInput = {
  mimeType: string;
  fileName: string;
  /** Raw file bytes when available */
  buffer?: Buffer;
  /** Fallback when buffer cannot be fetched */
  fallbackText?: string;
};

export type ExtractResult = {
  text: string;
  kind: "text" | "pdf" | "docx" | "unsupported";
  wordCount: number;
  truncated: boolean;
};

const MAX_CHARS = 8000;

export function normalizeMime(mimeType: string, fileName: string): string {
  const mime = (mimeType || "").toLowerCase();
  const name = (fileName || "").toLowerCase();
  if (mime.includes("pdf") || name.endsWith(".pdf")) return "application/pdf";
  if (
    mime.includes("wordprocessingml") ||
    mime.includes("msword") ||
    name.endsWith(".docx") ||
    name.endsWith(".doc")
  ) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (
    mime.startsWith("text/") ||
    mime.includes("json") ||
    mime.includes("xml") ||
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".csv")
  ) {
    return mime || "text/plain";
  }
  return mime || "application/octet-stream";
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function truncateForAnalysis(text: string, max = MAX_CHARS): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false };
  return { text: text.slice(0, max), truncated: true };
}

/** Best-effort PDF text extraction for analysis (not a full PDF parser). */
export function extractTextFromPdf(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const chunks: string[] = [];

  // Literal strings: (Hello World) Tj / '
  const tjRegex = /\((?:\\.|[^\\)])*\)\s*(?:Tj|'|")/g;
  let tjMatch: RegExpExecArray | null;
  while ((tjMatch = tjRegex.exec(raw)) !== null) {
    const token = tjMatch[0];
    const end = token.lastIndexOf(")");
    const inner = end > 0 ? token.slice(1, end) : "";
    chunks.push(unescapePdfString(inner));
  }

  // Array TJ operators: [(Hello) -10 (World)] TJ
  const arrRegex = /\[([\s\S]*?)\]\s*TJ/g;
  let arrMatch: RegExpExecArray | null;
  while ((arrMatch = arrRegex.exec(raw)) !== null) {
    const part = arrMatch[1] ?? "";
    const strRegex = /\((?:\\.|[^\\)])*\)/g;
    let strMatch: RegExpExecArray | null;
    while ((strMatch = strRegex.exec(part)) !== null) {
      chunks.push(unescapePdfString(strMatch[0].slice(1, -1)));
    }
  }

  const text = chunks.join(" ").replace(/\s+/g, " ").trim();
  if (text) return text;

  // Fallback: printable ASCII runs
  const ascii = raw
    .replace(/[^\x20-\x7E\n\r\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return ascii.slice(0, MAX_CHARS);
}

function unescapePdfString(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\([()\\])/g, "$1");
}

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const docXml = await zip.file("word/document.xml")?.async("string");
  if (!docXml) return "";
  // Split on paragraph ends to preserve rough spacing, strip tags
  const withBreaks = docXml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<[^>]+>/g, "");
  return withBreaks
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractDocumentContent(input: ExtractInput): Promise<ExtractResult> {
  const mime = normalizeMime(input.mimeType, input.fileName);
  let kind: ExtractResult["kind"] = "unsupported";
  let text = "";

  if (
    mime.startsWith("text/") ||
    mime.includes("json") ||
    (mime.includes("xml") && !mime.includes("wordprocessingml"))
  ) {
    kind = "text";
    text = input.buffer
      ? input.buffer.toString("utf8")
      : input.fallbackText || `Document: ${input.fileName}`;
  } else if (mime === "application/pdf") {
    kind = "pdf";
    text = input.buffer
      ? extractTextFromPdf(input.buffer)
      : input.fallbackText || `PDF Document: ${input.fileName}`;
    if (!text.trim()) text = `PDF Document: ${input.fileName}`;
  } else if (mime.includes("wordprocessingml") || mime.includes("msword")) {
    kind = "docx";
    if (input.buffer) {
      try {
        text = await extractTextFromDocx(input.buffer);
      } catch {
        text = "";
      }
    }
    if (!text.trim()) {
      text = input.fallbackText || `Word Document: ${input.fileName}`;
    }
  } else {
    text = input.fallbackText || `Document: ${input.fileName}`;
  }

  const { text: limited, truncated } = truncateForAnalysis(text);
  return {
    text: limited,
    kind,
    wordCount: countWords(limited),
    truncated,
  };
}

/** Parse LLM JSON analysis payload safely. */
export function parseAnalysisResponse(
  textContent: string,
  contentPreview: string
): {
  summary: string;
  keyPoints: string[];
  sentiment: string;
  documentType: string;
  wordCount: number;
  readingTime: number;
  extractedEntities: unknown[];
} {
  const wordCount = countWords(contentPreview);
  const fallback = {
    summary: "Unable to analyze document",
    keyPoints: [] as string[],
    sentiment: "neutral",
    documentType: "document",
    wordCount,
    readingTime: Math.max(1, Math.ceil(wordCount / 200)),
    extractedEntities: [] as unknown[],
  };

  const jsonMatch = textContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return fallback;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      summary: parsed.summary || fallback.summary,
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      sentiment: parsed.sentiment || "neutral",
      documentType: parsed.documentType || "document",
      wordCount,
      readingTime: Number(parsed.readingTime) || fallback.readingTime,
      extractedEntities: Array.isArray(parsed.entities)
        ? parsed.entities
        : Array.isArray(parsed.extractedEntities)
          ? parsed.extractedEntities
          : [],
    };
  } catch {
    return fallback;
  }
}
