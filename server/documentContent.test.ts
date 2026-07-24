import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import {
  extractDocumentContent,
  extractTextFromDocx,
  extractTextFromPdf,
  normalizeMime,
  parseAnalysisResponse,
} from "./documentContent";

async function buildDocx(paragraphs: string[]): Promise<Buffer> {
  const zip = new JSZip();
  const body = paragraphs
    .map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`)
    .join("");
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
     <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
       <w:body>${body}</w:body>
     </w:document>`
  );
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
     <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
       <Default Extension="xml" ContentType="application/xml"/>
       <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
     </Types>`
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

function buildPdf(text: string): Buffer {
  const doc = new jsPDF();
  doc.text(text, 20, 20);
  return Buffer.from(doc.output("arraybuffer"));
}

describe("document content extraction", () => {
  it("normalizes mime types from extension", () => {
    expect(normalizeMime("", "brief.pdf")).toBe("application/pdf");
    expect(normalizeMime("", "contract.docx")).toContain("wordprocessingml");
    expect(normalizeMime("text/plain", "notes.txt")).toBe("text/plain");
  });

  it("extracts plain text and markdown", async () => {
    const text = await extractDocumentContent({
      mimeType: "text/plain",
      fileName: "memo.txt",
      buffer: Buffer.from(
        "Engagement letter for Client Müller.\nScope: corporate advisory in Zürich."
      ),
    });
    expect(text.kind).toBe("text");
    expect(text.text).toContain("Müller");
    expect(text.wordCount).toBeGreaterThan(5);
  });

  it("extracts text from PDF buffers", async () => {
    const pdf = buildPdf("Confidential settlement agreement CHF 120000");
    const extracted = extractTextFromPdf(pdf);
    expect(extracted.toLowerCase()).toContain("settlement");

    const result = await extractDocumentContent({
      mimeType: "application/pdf",
      fileName: "settlement.pdf",
      buffer: pdf,
    });
    expect(result.kind).toBe("pdf");
    expect(result.text.toLowerCase()).toContain("settlement");
  });

  it("extracts text from Word (.docx) buffers", async () => {
    const docx = await buildDocx([
      "Employment Contract",
      "Employee: Alice Example",
      "Governing law: Switzerland",
    ]);
    const xmlText = await extractTextFromDocx(docx);
    expect(xmlText).toContain("Employment Contract");
    expect(xmlText).toContain("Alice Example");

    const result = await extractDocumentContent({
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileName: "employment.docx",
      buffer: docx,
    });
    expect(result.kind).toBe("docx");
    expect(result.text).toContain("Governing law");
  });

  it("parses LLM JSON analysis payloads", () => {
    const parsed = parseAnalysisResponse(
      'Here you go:\n{"summary":"A Swiss employment contract.","keyPoints":["Parties named","CH law"],"sentiment":"neutral","documentType":"contract","readingTime":3,"entities":["Alice Example"]}',
      "Employment Contract Employee: Alice Example Governing law: Switzerland"
    );
    expect(parsed.summary).toContain("employment");
    expect(parsed.keyPoints).toHaveLength(2);
    expect(parsed.documentType).toBe("contract");
    expect(parsed.extractedEntities).toContain("Alice Example");
  });

  it("falls back when LLM output is not JSON", () => {
    const parsed = parseAnalysisResponse("not json", "hello world");
    expect(parsed.summary).toBe("Unable to analyze document");
    expect(parsed.sentiment).toBe("neutral");
    expect(parsed.wordCount).toBe(2);
  });
});
