import { useEffect } from "react";
import { Link, useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { CmsPageBody } from "@/components/CmsBlockRenderer";
import { Scale } from "lucide-react";

/**
 * Public firm website.
 * Paths: /site/:firmSlug and /site/:firmSlug/:pageSlug
 * On firm subdomain/custom domain (no /site/ prefix), resolve firm from Host.
 */
export default function FirmPublicSitePage() {
  const params = useParams<{ firmSlug?: string; pageSlug?: string }>();
  const [location] = useLocation();
  const hostMode = !location.startsWith("/site/");
  const firmSlug = hostMode ? undefined : params.firmSlug;
  const pageSlug = hostMode
    ? location === "/" || location === ""
      ? undefined
      : location.replace(/^\//, "").split("/")[0]
    : params.pageSlug;

  const reserved = new Set([
    "login",
    "dashboard",
    "settings",
    "support",
    "account",
    "api",
    "help",
    "platform",
    "superadmin",
    "cms",
    "site",
  ]);
  const safePageSlug =
    pageSlug && !reserved.has(pageSlug) ? pageSlug : undefined;

  const { data, error, isLoading } = trpc.firmPages.publicPage.useQuery(
    {
      firmSlug,
      pageSlug: safePageSlug,
      home: !safePageSlug,
    },
    { retry: false }
  );

  useEffect(() => {
    if (!data?.page) return;
    const title = data.page.seoTitle || `${data.page.title} · ${data.firm.name}`;
    document.title = title;
    const desc = data.page.seoDescription || "";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);
  }, [data]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground bg-background">
        Loading…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 bg-background text-foreground">
        <Scale className="w-8 h-8 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          This firm website page is unpublished or does not exist yet.
        </p>
        {firmSlug && (
          <Link href={`/site/${firmSlug}`} className="text-sm underline text-[var(--color-navy)]">
            Back to home
          </Link>
        )}
      </div>
    );
  }

  const primary = data.firm.primaryColor || "#00BFA6";
  const hrefFor = (slug: string, isHome: boolean) => {
    if (hostMode) return isHome ? "/" : `/${slug}`;
    return isHome ? `/site/${data.firm.slug}` : `/site/${data.firm.slug}/${slug}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4 justify-between">
          <Link href={hrefFor("home", true)} className="flex items-center gap-2 min-w-0">
            {data.firm.logoUrl ? (
              <img src={data.firm.logoUrl} alt="" className="h-8 w-8 object-contain rounded" />
            ) : (
              <span
                className="h-8 w-8 rounded-lg flex items-center justify-center text-white"
                style={{ background: primary }}
              >
                <Scale className="w-4 h-4" />
              </span>
            )}
            <span className="font-semibold truncate">{data.firm.name}</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-3 text-sm">
            {data.nav.map((item) => (
              <Link
                key={item.slug}
                href={hrefFor(item.slug, item.isHome)}
                className={
                  item.slug === data.page.slug
                    ? "font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }
                style={item.slug === data.page.slug ? { color: primary } : undefined}
              >
                {item.title}
              </Link>
            ))}
            <Link
              href={data.firm.slug ? `/login?firm=${encodeURIComponent(data.firm.slug)}` : "/login"}
              className="px-3 py-1.5 rounded-lg text-white text-xs font-medium"
              style={{ background: primary }}
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <CmsPageBody content={data.page.content} primary={primary} />
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {data.firm.name}
      </footer>
    </div>
  );
}
