import type { CmsBlock, CmsDocument } from "@shared/cmsBlocks";
import { parseCmsDocument } from "@shared/cmsBlocks";
import { parseGrapesDocument } from "@shared/grapesPage";
import { cn, formatCurrency } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { User } from "lucide-react";

type RenderMode = "editor" | "public";

type RenderContext = {
  primary: string;
  mode: RenderMode;
  /** Required in public mode to fetch live packages/services for this firm. */
  firmSlug?: string;
};

function parseFeaturesJson(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function packagePrice(pkg: {
  monthlyPrice?: string | number | null;
  price?: string | number | null;
}): number {
  const v = pkg.monthlyPrice ?? pkg.price ?? 0;
  return Number(v) || 0;
}

function PackagesBlockView({
  data,
  ctx,
}: {
  data: { title?: string; subtitle?: string; limit?: number };
  ctx: RenderContext;
}) {
  const editorQuery = trpc.clientPackages.listForFirm.useQuery(undefined, {
    enabled: ctx.mode === "editor",
  });
  const publicQuery = trpc.clientPackages.listPublicByFirmSlug.useQuery(
    { firmSlug: ctx.firmSlug || "" },
    { enabled: ctx.mode === "public" && !!ctx.firmSlug }
  );

  const isLoading = ctx.mode === "editor" ? editorQuery.isLoading : publicQuery.isLoading;
  const source =
    ctx.mode === "editor"
      ? (editorQuery.data || []).filter((p: any) => p.isPublic && p.isActive)
      : publicQuery.data?.packages || [];
  const limit = data.limit && data.limit > 0 ? data.limit : undefined;
  const list = (limit ? source.slice(0, limit) : source) as any[];

  return (
    <section id="packages" className="px-6 py-14 sm:py-16">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          {data.title && <h2 className="text-2xl sm:text-3xl font-semibold">{data.title}</h2>}
          {data.subtitle && (
            <p className="text-muted-foreground max-w-xl mx-auto">{data.subtitle}</p>
          )}
        </div>
        {isLoading ? (
          <p className="text-center text-sm text-muted-foreground">Loading…</p>
        ) : list.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            No public packages yet — publish one from Upselling → Packages.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {list.map((pkg) => {
              const features = parseFeaturesJson(pkg.features);
              return (
                <div
                  key={pkg.id}
                  className="rounded-2xl border border-border bg-card p-6 space-y-3 flex flex-col"
                >
                  {pkg.highlightLabel && (
                    <span
                      className="inline-block w-fit text-[10px] uppercase tracking-wide font-semibold px-2 py-1 rounded-full text-white"
                      style={{ background: ctx.primary }}
                    >
                      {pkg.highlightLabel}
                    </span>
                  )}
                  <h3 className="text-lg font-semibold">{pkg.name}</h3>
                  <p className="text-2xl font-bold" style={{ color: ctx.primary }}>
                    {formatCurrency(packagePrice(pkg), pkg.currency)}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>
                  {pkg.description && (
                    <p className="text-sm text-muted-foreground">{pkg.description}</p>
                  )}
                  {features.length > 0 && (
                    <ul className="text-sm text-muted-foreground space-y-1 mt-1 flex-1">
                      {features.slice(0, 5).map((f) => (
                        <li key={f} className="flex items-start gap-1.5">
                          <span aria-hidden style={{ color: ctx.primary }}>
                            ✓
                          </span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                  {ctx.mode === "public" && ctx.firmSlug && (
                    <a
                      href={`/subscribe/${ctx.firmSlug}`}
                      className="mt-2 inline-flex justify-center rounded-lg px-4 py-2 text-sm font-medium text-white"
                      style={{ background: ctx.primary }}
                    >
                      Choose plan
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function ServicesBlockView({
  data,
  ctx,
}: {
  data: { title?: string; subtitle?: string; limit?: number };
  ctx: RenderContext;
}) {
  const editorQuery = trpc.ondemandServices.listForFirm.useQuery(undefined, {
    enabled: ctx.mode === "editor",
  });
  const publicQuery = trpc.ondemandServices.listPublicByFirmSlug.useQuery(
    { firmSlug: ctx.firmSlug || "" },
    { enabled: ctx.mode === "public" && !!ctx.firmSlug }
  );

  const isLoading = ctx.mode === "editor" ? editorQuery.isLoading : publicQuery.isLoading;
  const source =
    ctx.mode === "editor"
      ? (editorQuery.data || []).filter((s: any) => s.isPublic && s.isActive)
      : publicQuery.data?.services || [];
  const limit = data.limit && data.limit > 0 ? data.limit : undefined;
  const list = (limit ? source.slice(0, limit) : source) as any[];

  return (
    <section id="services" className="px-6 py-14 sm:py-16 bg-muted/40">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          {data.title && <h2 className="text-2xl sm:text-3xl font-semibold">{data.title}</h2>}
          {data.subtitle && (
            <p className="text-muted-foreground max-w-xl mx-auto">{data.subtitle}</p>
          )}
        </div>
        {isLoading ? (
          <p className="text-center text-sm text-muted-foreground">Loading…</p>
        ) : list.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            No public services yet — publish one from Upselling → Services.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {list.map((svc) => (
              <div
                key={svc.id}
                className="rounded-2xl border border-border bg-card p-6 space-y-2 flex flex-col"
              >
                <h3 className="text-lg font-semibold">{svc.name}</h3>
                <p className="text-xl font-bold" style={{ color: ctx.primary }}>
                  {formatCurrency(Number(svc.price) || 0, svc.currency)}
                </p>
                {svc.description && (
                  <p className="text-sm text-muted-foreground flex-1">{svc.description}</p>
                )}
                {Number(svc.estimatedHours) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    ~{Number(svc.estimatedHours)}h estimated
                  </p>
                )}
                {ctx.mode === "public" && ctx.firmSlug && (
                  <a
                    href={`/login?firm=${encodeURIComponent(ctx.firmSlug)}`}
                    className="mt-1 inline-flex justify-center rounded-lg px-4 py-2 text-sm font-medium text-white"
                    style={{ background: ctx.primary }}
                  >
                    Get started
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function BlockView({ block, ctx }: { block: CmsBlock; ctx: RenderContext }) {
  const primary = ctx.primary;
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
    case "stats":
      return (
        <section className="px-6 py-12">
          <div className="max-w-5xl mx-auto space-y-8">
            {block.data.title && (
              <h2 className="text-2xl font-semibold text-center">{block.data.title}</h2>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-center">
              {block.data.items.map((item, i) => (
                <div key={i}>
                  <p className="text-3xl sm:text-4xl font-bold" style={{ color: primary }}>
                    {item.value}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    case "testimonials":
      return (
        <section className="px-6 py-12 bg-muted/40">
          <div className="max-w-5xl mx-auto space-y-8">
            {block.data.title && (
              <h2 className="text-2xl font-semibold text-center">{block.data.title}</h2>
            )}
            <div className="grid sm:grid-cols-2 gap-6">
              {block.data.items.map((item, i) => (
                <figure key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
                  <blockquote className="text-sm leading-relaxed text-foreground">
                    “{item.quote}”
                  </blockquote>
                  <figcaption className="text-sm font-medium">
                    {item.author}
                    {item.role && (
                      <span className="text-muted-foreground font-normal"> · {item.role}</span>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      );
    case "team":
      return (
        <section className="px-6 py-12">
          <div className="max-w-5xl mx-auto space-y-8">
            {block.data.title && (
              <h2 className="text-2xl font-semibold text-center">{block.data.title}</h2>
            )}
            <div className="grid sm:grid-cols-3 gap-6">
              {block.data.items.map((item, i) => (
                <div key={i} className="text-center space-y-2">
                  <div className="w-20 h-20 rounded-full bg-muted mx-auto overflow-hidden flex items-center justify-center">
                    {item.photoUrl ? (
                      <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <p className="font-semibold">{item.name}</p>
                  {item.role && <p className="text-sm text-muted-foreground">{item.role}</p>}
                  {item.bio && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.bio}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    case "faq":
      return (
        <section className="px-6 py-12 bg-muted/40">
          <div className="max-w-3xl mx-auto space-y-6">
            {block.data.title && (
              <h2 className="text-2xl font-semibold text-center">{block.data.title}</h2>
            )}
            <div className="space-y-3">
              {block.data.items.map((item, i) => (
                <details
                  key={i}
                  className="rounded-xl border border-border bg-card p-4 group"
                  open={i === 0}
                >
                  <summary className="font-medium cursor-pointer list-none flex items-center justify-between gap-2">
                    {item.question}
                    <span className="text-muted-foreground group-open:rotate-45 transition-transform">+</span>
                  </summary>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      );
    case "gallery":
      return (
        <section className="px-6 py-12">
          <div className="max-w-5xl mx-auto space-y-6">
            {block.data.title && (
              <h2 className="text-2xl font-semibold text-center">{block.data.title}</h2>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {block.data.items
                .filter((item) => item.url)
                .map((item, i) => (
                  <figure key={i} className="rounded-xl overflow-hidden border border-border">
                    <img src={item.url} alt={item.caption || ""} className="w-full h-40 object-cover" />
                    {item.caption && (
                      <figcaption className="text-xs text-muted-foreground px-2 py-1.5">
                        {item.caption}
                      </figcaption>
                    )}
                  </figure>
                ))}
            </div>
          </div>
        </section>
      );
    case "logos":
      return (
        <section className="px-6 py-10">
          <div className="max-w-5xl mx-auto space-y-6">
            {block.data.title && (
              <p className="text-center text-sm uppercase tracking-wide text-muted-foreground">
                {block.data.title}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-8">
              {block.data.items.map((item, i) =>
                item.logoUrl ? (
                  <img key={i} src={item.logoUrl} alt={item.name} className="h-8 object-contain opacity-70" />
                ) : (
                  <span key={i} className="text-sm font-medium text-muted-foreground">
                    {item.name}
                  </span>
                )
              )}
            </div>
          </div>
        </section>
      );
    case "packages":
      return <PackagesBlockView data={block.data} ctx={ctx} />;
    case "services":
      return <ServicesBlockView data={block.data} ctx={ctx} />;
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
  mode = "editor",
  firmSlug,
}: {
  document: CmsDocument;
  primary?: string;
  className?: string;
  mode?: RenderMode;
  firmSlug?: string;
}) {
  const ctx: RenderContext = { primary, mode, firmSlug };
  return (
    <div className={cn("bg-background text-foreground", className)}>
      {document.blocks.map((block) => (
        <BlockView key={block.id} block={block} ctx={ctx} />
      ))}
    </div>
  );
}

/** Render CMS JSON blocks, GrapesJS visual pages, or fall back to plain HTML/text body. */
export function CmsPageBody({
  content,
  primary = "#00BFA6",
  mode = "public",
  firmSlug,
}: {
  content: string | null | undefined;
  primary?: string;
  mode?: RenderMode;
  firmSlug?: string;
}) {
  const grapes = parseGrapesDocument(content);
  if (grapes) {
    return (
      <div className="cms-grapes-page bg-background text-foreground">
        {grapes.css ? <style dangerouslySetInnerHTML={{ __html: grapes.css }} /> : null}
        <div dangerouslySetInnerHTML={{ __html: grapes.html || "" }} />
      </div>
    );
  }
  const doc = parseCmsDocument(content);
  if (doc) return <CmsBlocksView document={doc} primary={primary} mode={mode} firmSlug={firmSlug} />;
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
