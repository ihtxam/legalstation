/** Homepage / CMS block builder model (stored as JSON in firm_pages.content). */

export type CmsBlockType =
  | "hero"
  | "richText"
  | "features"
  | "cta"
  | "contact"
  | "image"
  | "divider";

export type CmsBlock =
  | {
      id: string;
      type: "hero";
      data: { eyebrow?: string; headline: string; subheadline?: string; ctaLabel?: string; ctaHref?: string };
    }
  | {
      id: string;
      type: "richText";
      data: { body: string };
    }
  | {
      id: string;
      type: "features";
      data: { title?: string; items: Array<{ title: string; description?: string }> };
    }
  | {
      id: string;
      type: "cta";
      data: { title: string; body?: string; buttonLabel?: string; buttonHref?: string };
    }
  | {
      id: string;
      type: "contact";
      data: { title?: string; email?: string; phone?: string; address?: string };
    }
  | {
      id: string;
      type: "image";
      data: { url: string; alt?: string; caption?: string };
    }
  | {
      id: string;
      type: "divider";
      data: Record<string, never>;
    };

export type CmsDocument = {
  v: 1;
  blocks: CmsBlock[];
};

export const CMS_BLOCK_TYPES: CmsBlockType[] = [
  "hero",
  "richText",
  "features",
  "cta",
  "contact",
  "image",
  "divider",
];

export type CmsTemplateId = "classic" | "minimal" | "contact";

function id() {
  return `b_${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyBlock(type: CmsBlockType): CmsBlock {
  switch (type) {
    case "hero":
      return {
        id: id(),
        type: "hero",
        data: {
          eyebrow: "Law firm",
          headline: "Trusted legal counsel",
          subheadline: "Clear advice for businesses and individuals.",
          ctaLabel: "Book a consultation",
          ctaHref: "#contact",
        },
      };
    case "richText":
      return {
        id: id(),
        type: "richText",
        data: {
          body: "Write your story, practice areas, or team introduction here.",
        },
      };
    case "features":
      return {
        id: id(),
        type: "features",
        data: {
          title: "How we help",
          items: [
            { title: "Corporate", description: "Contracts, governance, and transactions." },
            { title: "Litigation", description: "Clear strategy and strong representation." },
            { title: "Private clients", description: "Family, estate, and personal matters." },
          ],
        },
      };
    case "cta":
      return {
        id: id(),
        type: "cta",
        data: {
          title: "Ready to talk?",
          body: "Tell us about your matter — we respond within one business day.",
          buttonLabel: "Contact us",
          buttonHref: "#contact",
        },
      };
    case "contact":
      return {
        id: id(),
        type: "contact",
        data: {
          title: "Contact",
          email: "info@firm.ch",
          phone: "+41 00 000 00 00",
          address: "Bahnhofstrasse 1, 8001 Zürich",
        },
      };
    case "image":
      return {
        id: id(),
        type: "image",
        data: { url: "", alt: "Office", caption: "" },
      };
    case "divider":
      return { id: id(), type: "divider", data: {} };
  }
}

export function cmsTemplate(template: CmsTemplateId, firmName?: string): CmsDocument {
  const name = firmName?.trim() || "Your firm";
  if (template === "minimal") {
    return {
      v: 1,
      blocks: [
        {
          id: id(),
          type: "hero",
          data: {
            headline: name,
            subheadline: "Independent counsel. Practical outcomes.",
            ctaLabel: "Get in touch",
            ctaHref: "#contact",
          },
        },
        createEmptyBlock("richText"),
        {
          id: id(),
          type: "contact",
          data: { title: "Contact", email: "info@example.com" },
        },
      ],
    };
  }
  if (template === "contact") {
    return {
      v: 1,
      blocks: [
        {
          id: id(),
          type: "hero",
          data: {
            eyebrow: name,
            headline: "Speak with our team",
            subheadline: "Schedule a first conversation about your matter.",
            ctaLabel: "Email us",
            ctaHref: "mailto:info@example.com",
          },
        },
        createEmptyBlock("contact"),
        createEmptyBlock("cta"),
      ],
    };
  }
  // classic
  return {
    v: 1,
    blocks: [
      {
        id: id(),
        type: "hero",
        data: {
          eyebrow: name,
          headline: "Legal advice you can act on",
          subheadline: "Corporate, litigation, and private client services.",
          ctaLabel: "Request a call",
          ctaHref: "#contact",
        },
      },
      createEmptyBlock("features"),
      createEmptyBlock("richText"),
      createEmptyBlock("cta"),
      {
        id: id(),
        type: "contact",
        data: {
          title: "Contact",
          email: "info@example.com",
          phone: "+41 00 000 00 00",
          address: "",
        },
      },
    ],
  };
}

export function serializeCmsDocument(doc: CmsDocument): string {
  return JSON.stringify(doc);
}

export function parseCmsDocument(raw: string | null | undefined): CmsDocument | null {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as CmsDocument;
    if (parsed?.v === 1 && Array.isArray(parsed.blocks)) return parsed;
  } catch {
    /* plain HTML / markdown */
  }
  return null;
}

export function isCmsDocument(raw: string | null | undefined): boolean {
  return parseCmsDocument(raw) != null;
}

export function moveBlock(blocks: CmsBlock[], index: number, dir: -1 | 1): CmsBlock[] {
  const next = [...blocks];
  const j = index + dir;
  if (j < 0 || j >= next.length) return next;
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}
