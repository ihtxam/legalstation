import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import LexLayout from "@/components/LexLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Home, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

type PageForm = {
  id?: number;
  title: string;
  slug: string;
  content: string;
  published: boolean;
  isHome: boolean;
};

const emptyForm = (): PageForm => ({
  title: "",
  slug: "",
  content: "",
  published: false,
  isHome: false,
});

export default function FirmCmsPage() {
  const { t } = useTranslation();
  const { isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();
  const { data: pages, isLoading } = trpc.firmPages.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PageForm>(emptyForm());

  const create = trpc.firmPages.create.useMutation({
    onSuccess: async () => {
      toast.success(t("crm.pageSaved"));
      setOpen(false);
      setForm(emptyForm());
      await utils.firmPages.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const update = trpc.firmPages.update.useMutation({
    onSuccess: async () => {
      toast.success(t("crm.pageSaved"));
      setOpen(false);
      setForm(emptyForm());
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
    if (form.id) {
      update.mutate({
        id: form.id,
        title: form.title.trim(),
        slug: form.slug || undefined,
        content: form.content,
        published: form.published,
        isHome: form.isHome,
      });
    } else {
      create.mutate({
        title: form.title.trim(),
        slug: form.slug || undefined,
        content: form.content,
        published: form.published,
        isHome: form.isHome,
      });
    }
  };

  return (
    <LexLayout breadcrumb={[{ label: t("nav.cms") }]}>
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold">{t("crm.cmsTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("crm.cmsHint")}</p>
          </div>
          <Button
            className="bg-[var(--color-navy)] text-white"
            onClick={() => {
              setForm(emptyForm());
              setOpen(true);
            }}
          >
            <Plus className="w-4 h-4 me-1.5" /> {t("crm.newPage")}
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : !pages?.length ? (
          <p className="text-sm text-muted-foreground text-center py-10">{t("crm.noPages")}</p>
        ) : (
          <ul className="space-y-2">
            {pages.map((page) => (
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
                  <p className="text-xs text-muted-foreground mt-0.5">/{page.slug}</p>
                </div>
                <div className="flex items-center gap-1">
                  {!page.isHome && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setHome.mutate({ id: page.id })}
                    >
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
                        content: page.content || "",
                        published: page.published,
                        isHome: page.isHome,
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
                    onClick={() => remove.mutate({ id: page.id })}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? t("crm.editPage") : t("crm.newPage")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto">
            <div>
              <Label>{t("crm.pageTitle")}</Label>
              <Input
                className="mt-1"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t("crm.slug")}</Label>
              <Input
                className="mt-1"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="about"
              />
            </div>
            <div>
              <Label>{t("crm.content")}</Label>
              <Textarea
                className="mt-1 font-mono text-sm"
                rows={12}
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder={t("crm.contentPlaceholder")}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
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
    </LexLayout>
  );
}
