import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import CmsPageEditor, { type CmsPageForm } from "@/components/CmsPageEditor";
import GrapesJsEditor from "@/components/GrapesJsEditor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { serializeCmsDocument, cmsTemplate } from "@shared/cmsBlocks";
import {
  emptyGrapesDocument,
  parseGrapesDocument,
  serializeGrapesDocument,
} from "@shared/grapesPage";
import { ArrowLeft, Save, LayoutTemplate, Paintbrush } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const emptyForm = (firmName?: string, visual = true): CmsPageForm => ({
  title: "",
  slug: "",
  content: visual
    ? serializeGrapesDocument(emptyGrapesDocument(firmName))
    : serializeCmsDocument(cmsTemplate("classic", firmName)),
  published: false,
  isHome: false,
  seoTitle: "",
  seoDescription: "",
});

export default function FirmCmsEditorPage() {
  const { t } = useTranslation();
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const pageId = params.id && params.id !== "new" ? parseInt(params.id, 10) : null;
  const isNew = pageId == null || Number.isNaN(pageId);

  const utils = trpc.useUtils();
  const { data: firmData } = trpc.firm.myFirm.useQuery(undefined, { enabled: isAuthenticated });
  const { data: page, isLoading: pageLoading } = trpc.firmPages.get.useQuery(
    { id: pageId! },
    { enabled: isAuthenticated && !isNew && !!pageId }
  );

  const [form, setForm] = useState<CmsPageForm>(emptyForm());
  const [hydrated, setHydrated] = useState(isNew);
  const [builder, setBuilder] = useState<"visual" | "blocks">("visual");
  const [metaTab, setMetaTab] = useState<"page" | "seo">("page");

  useEffect(() => {
    if (!loading && !isAuthenticated) startLogin();
  }, [isAuthenticated, loading]);

  useEffect(() => {
    if (isNew) {
      setForm(emptyForm(firmData?.firm?.name, true));
      setBuilder("visual");
      setHydrated(true);
      return;
    }
    if (!page) return;
    const content =
      page.content || serializeGrapesDocument(emptyGrapesDocument(firmData?.firm?.name));
    setForm({
      id: page.id,
      title: page.title,
      slug: page.slug,
      content,
      published: page.published,
      isHome: page.isHome,
      seoTitle: page.seoTitle || "",
      seoDescription: page.seoDescription || "",
    });
    setBuilder(parseGrapesDocument(content) ? "visual" : "blocks");
    setHydrated(true);
  }, [isNew, page, firmData?.firm?.name]);

  const create = trpc.firmPages.create.useMutation({
    onSuccess: async (res) => {
      toast.success(t("crm.pageSaved"));
      await utils.firmPages.list.invalidate();
      if (res?.id) navigate(`/cms/${res.id}`);
      else navigate("/cms");
    },
    onError: (e) => toast.error(e.message),
  });

  const update = trpc.firmPages.update.useMutation({
    onSuccess: async () => {
      toast.success(t("crm.pageSaved"));
      await utils.firmPages.list.invalidate();
      if (pageId) await utils.firmPages.get.invalidate({ id: pageId });
    },
    onError: (e) => toast.error(e.message),
  });

  const save = () => {
    if (!form.title.trim()) {
      toast.error(t("cms.pageTitleRequired"));
      return;
    }
    const payload = {
      title: form.title.trim(),
      slug: form.isHome ? "home" : form.slug || undefined,
      content: form.content,
      published: form.published,
      isHome: form.isHome,
      seoTitle: form.seoTitle.trim() || null,
      seoDescription: form.seoDescription.trim() || null,
    };
    if (form.id) update.mutate({ id: form.id, ...payload });
    else create.mutate(payload);
  };

  const switchBuilder = (next: "visual" | "blocks") => {
    if (next === builder) return;
    if (next === "visual") {
      if (
        !parseGrapesDocument(form.content) &&
        !confirm(t("cms.switchToVisualConfirm"))
      ) {
        return;
      }
      setForm((f) => ({
        ...f,
        content: parseGrapesDocument(f.content)
          ? f.content
          : serializeGrapesDocument(emptyGrapesDocument(firmData?.firm?.name || f.title)),
      }));
    } else {
      if (!confirm(t("cms.switchToBlocksConfirm"))) return;
      setForm((f) => ({
        ...f,
        content: serializeCmsDocument(cmsTemplate("classic", firmData?.firm?.name || f.title)),
      }));
    }
    setBuilder(next);
  };

  const busy = create.isPending || update.isPending;

  if (loading || !isAuthenticated) return null;

  return (
    <AppLayout
      breadcrumb={[
        { label: t("nav.cms"), href: "/cms" },
        { label: isNew ? t("crm.newPage") : t("crm.editPage") },
      ]}
    >
      <div className="page-shell max-w-[1400px] !space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 py-2 -mt-1 border-b border-border/60">
          <div className="min-w-0 flex items-start gap-2">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="shrink-0 mt-0.5"
              onClick={() => navigate("/cms")}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold truncate">
                {isNew ? t("crm.newPage") : form.title || t("crm.editPage")}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">{t("cms.visualEditorHint")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 rounded-lg border border-border p-0.5 bg-muted/40">
              <button
                type="button"
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5",
                  builder === "visual" ? "bg-background shadow-sm" : "text-muted-foreground"
                )}
                onClick={() => switchBuilder("visual")}
              >
                <Paintbrush className="w-3.5 h-3.5" />
                {t("cms.visualBuilder")}
              </button>
              <button
                type="button"
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5",
                  builder === "blocks" ? "bg-background shadow-sm" : "text-muted-foreground"
                )}
                onClick={() => switchBuilder("blocks")}
              >
                <LayoutTemplate className="w-3.5 h-3.5" />
                {t("cms.blockBuilder")}
              </button>
            </div>
            <Button type="button" variant="outline" onClick={() => navigate("/cms")}>
              {t("common.cancel")}
            </Button>
            <Button
              className="bg-[var(--color-navy)] text-white"
              disabled={!form.title.trim() || busy || !hydrated}
              onClick={save}
            >
              <Save className="w-4 h-4 me-1.5" />
              {busy ? t("common.loading") : t("common.save")}
            </Button>
          </div>
        </div>

        {!hydrated || (!isNew && pageLoading) ? (
          <div className="grid lg:grid-cols-2 gap-4">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        ) : !isNew && !page ? (
          <p className="text-sm text-muted-foreground py-10 text-center">{t("cms.pageNotFound")}</p>
        ) : builder === "blocks" ? (
          <CmsPageEditor
            form={form}
            setForm={setForm}
            firmName={firmData?.firm?.name}
            primaryColor={firmData?.firm?.primaryColor || "#00BFA6"}
            livePreview
          />
        ) : (
          <div className="space-y-4">
            <div className="flex gap-1 rounded-lg border border-border p-0.5 bg-muted/40 w-fit">
              {(["page", "seo"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={cn(
                    "px-3.5 py-1.5 text-sm font-medium rounded-md",
                    metaTab === key ? "bg-background shadow-sm" : "text-muted-foreground"
                  )}
                  onClick={() => setMetaTab(key)}
                >
                  {key === "page" ? t("cms.tab.content") : t("cms.tab.seo")}
                </button>
              ))}
            </div>

            {metaTab === "seo" ? (
              <div className="space-y-3 rounded-xl border border-border p-4 bg-card max-w-2xl">
                <div>
                  <Label>{t("cms.seoTitle")}</Label>
                  <Input
                    className="mt-1.5"
                    value={form.seoTitle}
                    maxLength={255}
                    onChange={(e) => setForm((f) => ({ ...f, seoTitle: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>{t("cms.seoDescription")}</Label>
                  <Textarea
                    className="mt-1.5"
                    rows={4}
                    maxLength={500}
                    value={form.seoDescription}
                    onChange={(e) => setForm((f) => ({ ...f, seoDescription: e.target.value }))}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3 max-w-3xl">
                  <div>
                    <Label>{t("crm.pageTitle")}</Label>
                    <Input
                      className="mt-1.5"
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>{t("crm.slug")}</Label>
                    <Input
                      className="mt-1.5"
                      value={form.slug}
                      onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                      disabled={form.isHome}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-6 flex-wrap rounded-xl border border-border bg-muted/30 px-4 py-3 max-w-3xl">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={form.published}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, published: v }))}
                    />
                    {t("crm.published")}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={form.isHome}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, isHome: v }))}
                    />
                    {t("crm.setAsHomepage")}
                  </label>
                </div>
                <GrapesJsEditor
                  key={form.id || "new"}
                  content={form.content}
                  firmName={firmData?.firm?.name}
                  onChange={(serialized) => setForm((f) => ({ ...f, content: serialized }))}
                  height="72vh"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
