/** Homepage / CMS block builder model (stored as JSON in firm_pages.content). */

export type CmsBlockType =
  | "hero"
  | "richText"
  | "features"
  | "stats"
  | "testimonials"
  | "team"
  | "faq"
  | "gallery"
  | "logos"
  | "packages"
  | "services"
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
      type: "stats";
      data: { title?: string; items: Array<{ value: string; label: string }> };
    }
  | {
      id: string;
      type: "testimonials";
      data: { title?: string; items: Array<{ quote: string; author: string; role?: string }> };
    }
  | {
      id: string;
      type: "team";
      data: { title?: string; items: Array<{ name: string; role?: string; photoUrl?: string; bio?: string }> };
    }
  | {
      id: string;
      type: "faq";
      data: { title?: string; items: Array<{ question: string; answer: string }> };
    }
  | {
      id: string;
      type: "gallery";
      data: { title?: string; items: Array<{ url: string; caption?: string }> };
    }
  | {
      id: string;
      type: "logos";
      data: { title?: string; items: Array<{ name: string; logoUrl?: string }> };
    }
  | {
      id: string;
      type: "packages";
      /** Live subscription packages pulled from the firm's catalog at render time. */
      data: { title?: string; subtitle?: string; limit?: number };
    }
  | {
      id: string;
      type: "services";
      /** Live on-demand services pulled from the firm's catalog at render time. */
      data: { title?: string; subtitle?: string; limit?: number };
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
  "stats",
  "testimonials",
  "team",
  "faq",
  "gallery",
  "logos",
  "packages",
  "services",
  "cta",
  "contact",
  "image",
  "divider",
];

/** Block types rendered from live firm data — not manually authored content. */
export const CMS_DYNAMIC_BLOCK_TYPES = new Set<CmsBlockType>(["packages", "services"]);

export type CmsTemplateId = "classic" | "minimal" | "contact" | "modern" | "services" | "team";

export const CMS_TEMPLATE_IDS: CmsTemplateId[] = [
  "classic",
  "modern",
  "minimal",
  "services",
  "team",
  "contact",
];

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
    case "stats":
      return {
        id: id(),
        type: "stats",
        data: {
          title: "By the numbers",
          items: [
            { value: "500+", label: "Cases handled" },
            { value: "20+", label: "Years of experience" },
            { value: "98%", label: "Client satisfaction" },
          ],
        },
      };
    case "testimonials":
      return {
        id: id(),
        type: "testimonials",
        data: {
          title: "What clients say",
          items: [
            {
              quote: "Responsive, sharp, and always clear about our options.",
              author: "Anna K.",
              role: "Managing Director",
            },
            {
              quote: "They handled a complex matter with real care and precision.",
              author: "Marco B.",
              role: "Private client",
            },
          ],
        },
      };
    case "team":
      return {
        id: id(),
        type: "team",
        data: {
          title: "Our team",
          items: [
            { name: "Jane Doe", role: "Managing Partner", photoUrl: "", bio: "" },
            { name: "John Smith", role: "Senior Associate", photoUrl: "", bio: "" },
          ],
        },
      };
    case "faq":
      return {
        id: id(),
        type: "faq",
        data: {
          title: "Frequently asked questions",
          items: [
            {
              question: "How does the first consultation work?",
              answer: "We start with a short call to understand your matter and next steps.",
            },
            {
              question: "How are fees structured?",
              answer: "Hourly, flat-fee, or subscription packages depending on the matter.",
            },
          ],
        },
      };
    case "gallery":
      return {
        id: id(),
        type: "gallery",
        data: {
          title: "Our office",
          items: [
            { url: "", caption: "" },
            { url: "", caption: "" },
            { url: "", caption: "" },
          ],
        },
      };
    case "logos":
      return {
        id: id(),
        type: "logos",
        data: {
          title: "Trusted by",
          items: [{ name: "Client A" }, { name: "Client B" }, { name: "Client C" }],
        },
      };
    case "packages":
      return {
        id: id(),
        type: "packages",
        data: {
          title: "Subscription packages",
          subtitle: "Predictable legal support with monthly, biannual, or yearly plans.",
          limit: 3,
        },
      };
    case "services":
      return {
        id: id(),
        type: "services",
        data: {
          title: "On-demand services",
          subtitle: "One-off contracts, reviews, and advice — buy what you need, when you need it.",
          limit: 3,
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
        createEmptyBlock("faq"),
        createEmptyBlock("cta"),
      ],
    };
  }
  if (template === "modern") {
    return {
      v: 1,
      blocks: [
        {
          id: id(),
          type: "hero",
          data: {
            eyebrow: name,
            headline: "Modern legal counsel, personal attention",
            subheadline: "Corporate, litigation, and private client work — handled end to end.",
            ctaLabel: "Book a consultation",
            ctaHref: "#contact",
          },
        },
        createEmptyBlock("stats"),
        createEmptyBlock("features"),
        createEmptyBlock("testimonials"),
        createEmptyBlock("cta"),
        createEmptyBlock("contact"),
      ],
    };
  }
  if (template === "services") {
    return {
      v: 1,
      blocks: [
        {
          id: id(),
          type: "hero",
          data: {
            eyebrow: name,
            headline: "Legal help, on your terms",
            subheadline: "Subscribe for ongoing support, or buy one-off services as you need them.",
            ctaLabel: "See plans",
            ctaHref: "#packages",
          },
        },
        createEmptyBlock("packages"),
        createEmptyBlock("services"),
        createEmptyBlock("faq"),
        createEmptyBlock("contact"),
      ],
    };
  }
  if (template === "team") {
    return {
      v: 1,
      blocks: [
        {
          id: id(),
          type: "hero",
          data: {
            eyebrow: name,
            headline: "Meet the team behind your matter",
            subheadline: "Experienced counsel, working together for you.",
            ctaLabel: "Get in touch",
            ctaHref: "#contact",
          },
        },
        createEmptyBlock("team"),
        createEmptyBlock("testimonials"),
        createEmptyBlock("logos"),
        createEmptyBlock("cta"),
        createEmptyBlock("contact"),
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

/** Remove the block at `from` and insert it at `to` (drag-and-drop reorder). */
export function reorderBlocks(blocks: CmsBlock[], from: number, to: number): CmsBlock[] {
  if (from === to || from < 0 || from >= blocks.length) return blocks;
  const next = [...blocks];
  const [moved] = next.splice(from, 1);
  const clampedTo = Math.max(0, Math.min(next.length, to));
  next.splice(clampedTo, 0, moved);
  return next;
}
