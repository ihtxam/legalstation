import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import CmsPageEditor, { type CmsPageForm } from "@/components/CmsPageEditor";
import { serializeCmsDocument, cmsTemplate } from "@shared/cmsBlocks";
import { ArrowLeft, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

const emptyForm = (firmName?: string): CmsPageForm => ({
  title: "",
  slug: "",
  content: serializeCmsDocument(cmsTemplate("classic", firmName)),
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

  useEffect(() => {
    if (!loading && !isAuthenticated) startLogin();
  }, [isAuthenticated, loading]);

  useEffect(() => {
    if (isNew) {
      setForm(emptyForm(firmData?.firm?.name));
      setHydrated(true);
      return;
    }
    if (!page) return;
    setForm({
      id: page.id,
      title: page.title,
      slug: page.slug,
      content:
        page.content || serializeCmsDocument(cmsTemplate("classic", firmData?.firm?.name)),
      published: page.published,
      isHome: page.isHome,
      seoTitle: page.seoTitle || "",
      seoDescription: page.seoDescription || "",
    });
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
              <p className="text-sm text-muted-foreground mt-0.5">{t("cms.editorHint")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
        ) : (
          <CmsPageEditor
            form={form}
            setForm={setForm}
            firmName={firmData?.firm?.name}
            primaryColor={firmData?.firm?.primaryColor || "#00BFA6"}
            livePreview
          />
        )}
      </div>
    </AppLayout>
  );
}
