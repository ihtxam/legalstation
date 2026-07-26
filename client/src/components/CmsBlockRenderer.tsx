import type { CmsBlock, CmsDocument } from "@shared/cmsBlocks";
import { parseCmsDocument } from "@shared/cmsBlocks";
import { cn } from "@/lib/utils";

function BlockView({
  block,
  primary,
}: {
  block: CmsBlock;
  primary: string;
}) {
  switch (block.type) {
    case "hero":
      return (
        <section
          className="px-6 py-16 sm:py-24 text-white"
          style={{ background: `linear-gradient(135deg, ${primary} 0%, #0f766e 100%)` }}
        >
          <div className="max-w-3xl mx-auto text-center space-y-4">
            {block.data.eyebrow && (
              <p className="text-sm uppercase tracking-[0.14em] text-white/80">{block.data.eyebrow}</p>
            )}
            <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight">{block.data.headline}</h1>
            {block.data.subheadline && (
              <p className="text-base sm:text-lg text-white/90 leading-relaxed">{block.data.subheadline}</p>
            )}
            {block.data.ctaLabel && (
              <a
                href={block.data.ctaHref || "#"}
                className="inline-flex mt-2 px-5 py-2.5 rounded-lg bg-white font-medium text-sm"
                style={{ color: primary }}
              >
                {block.data.ctaLabel}
              </a>
            )}
          </div>
        </section>
      );
    case "richText":
      return (
        <section className="px-6 py-12">
          <div className="max-w-3xl mx-auto prose prose-slate dark:prose-invert whitespace-pre-wrap text-foreground leading-relaxed">
            {block.data.body}
          </div>
        </section>
      );
    case "features":
      return (
        <section className="px-6 py-12 bg-muted/40">
          <div className="max-w-5xl mx-auto space-y-8">
            {block.data.title && (
              <h2 className="text-2xl font-semibold text-center">{block.data.title}</h2>
            )}
            <div className="grid sm:grid-cols-3 gap-6">
              {block.data.items.map((item, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-2">
                  <h3 className="font-semibold" style={{ color: primary }}>
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    case "cta":
      return (
        <section className="px-6 py-12">
          <div
            className="max-w-3xl mx-auto rounded-2xl px-6 py-10 text-center text-white space-y-3"
            style={{ background: primary }}
          >
            <h2 className="text-2xl font-semibold">{block.data.title}</h2>
            {block.data.body && <p className="text-white/90">{block.data.body}</p>}
            {block.data.buttonLabel && (
              <a
                href={block.data.buttonHref || "#"}
                className="inline-flex mt-2 px-5 py-2.5 rounded-lg bg-white font-medium text-sm"
                style={{ color: primary }}
              >
                {block.data.buttonLabel}
              </a>
            )}
          </div>
        </section>
      );
    case "contact":
      return (
        <section id="contact" className="px-6 py-12">
          <div className="max-w-xl mx-auto rounded-xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-xl font-semibold">{block.data.title || "Contact"}</h2>
            {block.data.email && (
              <p className="text-sm">
                <a className="underline" href={`mailto:${block.data.email}`} style={{ color: primary }}>
                  {block.data.email}
                </a>
              </p>
            )}
            {block.data.phone && <p className="text-sm text-muted-foreground">{block.data.phone}</p>}
            {block.data.address && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{block.data.address}</p>}
          </div>
        </section>
      );
    case "image":
      if (!block.data.url) return null;
      return (
        <section className="px-6 py-10">
          <figure className="max-w-4xl mx-auto">
            <img
              src={block.data.url}
              alt={block.data.alt || ""}
              className="w-full rounded-xl border border-border object-cover max-h-[480px]"
            />
            {block.data.caption && (
              <figcaption className="text-xs text-muted-foreground mt-2 text-center">
                {block.data.caption}
              </figcaption>
            )}
          </figure>
        </section>
      );
    case "divider":
      return <hr className="border-border my-4 max-w-3xl mx-auto w-[calc(100%-3rem)]" />;
    default:
      return null;
  }
}

export function CmsBlocksView({
  document,
  primary = "#00BFA6",
  className,
}: {
  document: CmsDocument;
  primary?: string;
  className?: string;
}) {
  return (
    <div className={cn("bg-background text-foreground", className)}>
      {document.blocks.map((block) => (
        <BlockView key={block.id} block={block} primary={primary} />
      ))}
    </div>
  );
}

/** Render CMS JSON blocks or fall back to plain HTML/text body. */
export function CmsPageBody({
  content,
  primary = "#00BFA6",
}: {
  content: string | null | undefined;
  primary?: string;
}) {
  const doc = parseCmsDocument(content);
  if (doc) return <CmsBlocksView document={doc} primary={primary} />;
  if (!content?.trim()) return null;
  // Legacy HTML / plain text
  if (/<[a-z][\s\S]*>/i.test(content)) {
    return (
      <div
        className="prose prose-slate dark:prose-invert max-w-3xl mx-auto px-6 py-12"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 whitespace-pre-wrap leading-relaxed text-foreground">
      {content}
    </div>
  );
}
