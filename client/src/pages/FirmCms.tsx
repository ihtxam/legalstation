import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CmsPageEditor, { type CmsPageForm } from "@/components/CmsPageEditor";
import { serializeCmsDocument, cmsTemplate } from "@shared/cmsBlocks";
import { ExternalLink, Home, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const emptyForm = (firmName?: string): CmsPageForm => ({
  title: "",
  slug: "",
  content: serializeCmsDocument(cmsTemplate("classic", firmName)),
  published: false,
  isHome: false,
  seoTitle: "",
  seoDescription: "",
});

export default function FirmCmsPage() {
  const { t } = useTranslation();
  const { isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();
  const { data: firmData } = trpc.firm.myFirm.useQuery(undefined, { enabled: isAuthenticated });
  const { data: pages, isLoading } = trpc.firmPages.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: urls } = trpc.firmPages.publicUrls.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CmsPageForm>(emptyForm());

  const create = trpc.firmPages.create.useMutation({
    onSuccess: async () => {
      toast.success(t("crm.pageSaved"));
      setOpen(false);
      setForm(emptyForm(firmData?.firm?.name));
      await utils.firmPages.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const update = trpc.firmPages.update.useMutation({
    onSuccess: async () => {
      toast.success(t("crm.pageSaved"));
      setOpen(false);
      setForm(emptyForm(firmData?.firm?.name));
      await utils.firmPages.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const setHome = trpc.firmPages.setHome.useMutation({
    onSuccess: () => {
      toast.success(t("crm.homeSet"));
      utils.firmPages.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = trpc.firmPages.delete.useMutation({
    onSuccess: () => {
      toast.success(t("crm.pageDeleted"));
      utils.firmPages.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) startLogin();
  }, [isAuthenticated, loading]);

  const save = () => {
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      slug: form.isHome ? "home" : form.slug || undefined,
      content: form.content,
      published: form.published,
      isHome: form.isHome,
      seoTitle: form.seoTitle.trim() || null,
      seoDescription: form.seoDescription.trim() || null,
    };
    if (form.id) {
      update.mutate({ id: form.id, ...payload });
    } else {
      create.mutate(payload);
    }
  };

  const pagePublicUrl = (page: { slug: string; isHome: boolean; published: boolean }) => {
    if (!page.published || !urls?.pathHome) return null;
    if (page.isHome) return urls.preferredHome || urls.pathHome;
    return urls.pathPage?.(page.slug) || `${urls.pathHome}/${page.slug}`;
  };

  return (
    <AppLayout breadcrumb={[{ label: t("nav.cms") }]}>
      <div className="page-shell max-w-4xl !space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold">{t("crm.cmsTitle")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("crm.cmsHint")}</p>
          </div>
          <Button
            className="bg-[var(--color-navy)] text-white"
            onClick={() => {
              setForm(emptyForm(firmData?.firm?.name));
              setOpen(true);
            }}
          >
            <Plus className="w-4 h-4 me-1.5" /> {t("crm.newPage")}
          </Button>
        </div>

        {urls && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-sm">
            <p className="font-medium">{t("cms.publicUrlsTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("cms.publicUrlsHint")}</p>
            <ul className="space-y-1.5 text-xs break-all">
              {urls.pathHome && (
                <li>
                  <span className="text-muted-foreground">{t("cms.urlPath")}: </span>
                  <a href={urls.pathHome} target="_blank" rel="noreferrer" className="underline text-[var(--color-navy)]">
                    {urls.pathHome}
                  </a>
                </li>
              )}
              {urls.subdomainHome && (
                <li>
                  <span className="text-muted-foreground">{t("cms.urlSubdomain")}: </span>
                  <a href={urls.subdomainHome} target="_blank" rel="noreferrer" className="underline text-[var(--color-navy)]">
                    {urls.subdomainHome}
                  </a>
                  {urls.baseDomain && (
                    <span className="text-muted-foreground"> ({urls.slug}.{urls.baseDomain})</span>
                  )}
                </li>
              )}
              {urls.customHome && (
                <li>
                  <span className="text-muted-foreground">{t("cms.urlCustom")}: </span>
                  <a href={urls.customHome} target="_blank" rel="noreferrer" className="underline text-[var(--color-navy)]">
                    {urls.customHome}
                  </a>
                </li>
              )}
              {!urls.subdomainHome && (
                <li className="text-muted-foreground">{t("cms.subdomainDnsHint")}</li>
              )}
            </ul>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : !pages?.length ? (
          <p className="text-sm text-muted-foreground text-center py-10">{t("crm.noPages")}</p>
        ) : (
          <ul className="space-y-2">
            {pages.map((page) => {
              const pub = pagePublicUrl(page);
              return (
                <li
                  key={page.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{page.title}</p>
                      {page.isHome && (
                        <Badge className="bg-[var(--color-navy)] text-white">
                          <Home className="w-3 h-3 me-1" /> {t("crm.homepage")}
                        </Badge>
                      )}
                      <Badge variant={page.published ? "default" : "secondary"}>
                        {page.published ? t("crm.published") : t("crm.draft")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {page.isHome ? "/" : `/${page.slug}`}
                      {page.seoTitle ? ` · SEO: ${page.seoTitle}` : ""}
                    </p>
                    {pub && (
                      <a
                        href={pub}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[var(--color-navy)] underline mt-1"
                      >
                        {t("cms.viewLive")} <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!page.isHome && (
                      <Button size="sm" variant="outline" onClick={() => setHome.mutate({ id: page.id })}>
                        {t("crm.setHome")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setForm({
                          id: page.id,
                          title: page.title,
                          slug: page.slug,
                          content:
                            page.content ||
                            serializeCmsDocument(cmsTemplate("classic", firmData?.firm?.name)),
                          published: page.published,
                          isHome: page.isHome,
                          seoTitle: page.seoTitle || "",
                          seoDescription: page.seoDescription || "",
                        });
                        setOpen(true);
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        if (confirm(t("cms.deleteConfirm"))) remove.mutate({ id: page.id });
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{form.id ? t("crm.editPage") : t("crm.newPage")}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-2 pe-1">
            <CmsPageEditor
              form={form}
              setForm={setForm}
              firmName={firmData?.firm?.name}
              primaryColor={firmData?.firm?.primaryColor || "#00BFA6"}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              className="bg-[var(--color-navy)] text-white"
              disabled={!form.title.trim() || create.isPending || update.isPending}
              onClick={save}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
