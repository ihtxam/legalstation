import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CMS_BLOCK_TYPES,
  type CmsBlock,
  type CmsBlockType,
  type CmsDocument,
  type CmsTemplateId,
  createEmptyBlock,
  cmsTemplate,
  moveBlock,
  parseCmsDocument,
  serializeCmsDocument,
} from "@shared/cmsBlocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CmsBlocksView } from "@/components/CmsBlockRenderer";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  LayoutTemplate,
  MonitorSmartphone,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type CmsPageForm = {
  id?: number;
  title: string;
  slug: string;
  content: string;
  published: boolean;
  isHome: boolean;
  seoTitle: string;
  seoDescription: string;
};

type Props = {
  form: CmsPageForm;
  setForm: React.Dispatch<React.SetStateAction<CmsPageForm>>;
  firmName?: string;
  primaryColor?: string;
  /** When true, show live preview beside the editor (full-page mode). */
  livePreview?: boolean;
};

function ensureDoc(content: string, firmName?: string): CmsDocument {
  return parseCmsDocument(content) || cmsTemplate("classic", firmName);
}

export default function CmsPageEditor({
  form,
  setForm,
  firmName,
  primaryColor,
  livePreview = true,
}: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"content" | "seo">("content");
  const [mobilePreview, setMobilePreview] = useState(false);
  const doc = useMemo(() => ensureDoc(form.content, firmName), [form.content, firmName]);
  const primary = primaryColor || "#00BFA6";

  const setDoc = (next: CmsDocument) => {
    setForm((f) => ({ ...f, content: serializeCmsDocument(next) }));
  };

  const updateBlock = (index: number, block: CmsBlock) => {
    const blocks = [...doc.blocks];
    blocks[index] = block;
    setDoc({ v: 1, blocks });
  };

  const applyTemplate = (id: CmsTemplateId) => {
    if (!confirm(t("cms.replaceWithTemplate"))) return;
    setDoc(cmsTemplate(id, firmName || form.title));
  };

  const meta = (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label>{t("crm.pageTitle")}</Label>
          <Input
            className="mt-1.5"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder={t("cms.pageTitlePlaceholder")}
          />
        </div>
        <div>
          <Label>{t("crm.slug")}</Label>
          <Input
            className="mt-1.5"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            placeholder="about"
            disabled={form.isHome}
          />
          {form.isHome && (
            <p className="text-[11px] text-muted-foreground mt-1">{t("cms.homeSlugHint")}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6 flex-wrap rounded-xl border border-border bg-muted/30 px-4 py-3">
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
  );

  const tabs = (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex gap-1 rounded-lg border border-border p-0.5 bg-muted/40 w-fit">
        {(["content", "seo"] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={cn(
              "px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors",
              tab === key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
            )}
            onClick={() => setTab(key)}
          >
            {t(`cms.tab.${key}`)}
          </button>
        ))}
      </div>
      {livePreview && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="lg:hidden"
          onClick={() => setMobilePreview((v) => !v)}
        >
          <Eye className="w-3.5 h-3.5 me-1.5" />
          {mobilePreview ? t("cms.hidePreview") : t("cms.showPreview")}
        </Button>
      )}
    </div>
  );

  const contentPanel = (
    <div className="space-y-4">
      {tab === "seo" ? (
        <div className="space-y-3 rounded-xl border border-border p-4 bg-card">
          <p className="text-sm text-muted-foreground">{t("cms.seoHint")}</p>
          <div>
            <Label>{t("cms.seoTitle")}</Label>
            <Input
              className="mt-1.5"
              value={form.seoTitle}
              maxLength={255}
              onChange={(e) => setForm((f) => ({ ...f, seoTitle: e.target.value }))}
              placeholder={form.title || t("cms.seoTitlePlaceholder")}
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
              placeholder={t("cms.seoDescriptionPlaceholder")}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              {form.seoDescription.length}/500
            </p>
          </div>
          {(form.seoTitle || form.title) && (
            <div className="rounded-lg border border-border bg-background p-3 space-y-1">
              <p className="text-xs text-muted-foreground">{t("cms.seoSnippetPreview")}</p>
              <p className="text-base text-blue-700 dark:text-blue-400 truncate">
                {form.seoTitle || form.title}
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 truncate">
                /{form.isHome ? "" : form.slug || "page"}
              </p>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {form.seoDescription || t("cms.seoDescriptionPlaceholder")}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <LayoutTemplate className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium me-1">{t("cms.templates")}</span>
              {(
                [
                  ["classic", "cms.templateClassic"],
                  ["minimal", "cms.templateMinimal"],
                  ["contact", "cms.templateContact"],
                ] as const
              ).map(([id, key]) => (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => applyTemplate(id)}
                >
                  {t(key)}
                </Button>
              ))}
            </div>
            <div>
              <p className="text-sm font-medium mb-2">{t("cms.addBlock")}</p>
              <div className="flex flex-wrap gap-1.5">
                {CMS_BLOCK_TYPES.map((type) => (
                  <Button
                    key={type}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setDoc({ v: 1, blocks: [...doc.blocks, createEmptyBlock(type)] })
                    }
                  >
                    <Plus className="w-3 h-3 me-1" />
                    {t(`cms.blocks.${type}`)}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {doc.blocks.map((block, index) => (
              <div key={block.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(`cms.blocks.${block.type as CmsBlockType}`)}
                  </p>
                  <div className="flex items-center gap-0.5">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      disabled={index === 0}
                      onClick={() => setDoc({ v: 1, blocks: moveBlock(doc.blocks, index, -1) })}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      disabled={index === doc.blocks.length - 1}
                      onClick={() => setDoc({ v: 1, blocks: moveBlock(doc.blocks, index, 1) })}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() =>
                        setDoc({ v: 1, blocks: doc.blocks.filter((_, i) => i !== index) })
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <BlockFields block={block} onChange={(b) => updateBlock(index, b)} />
              </div>
            ))}
            {!doc.blocks.length && (
              <p className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border rounded-xl">
                {t("cms.noBlocks")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const previewPanel = (
    <div className="rounded-xl border border-border bg-background overflow-hidden shadow-sm flex flex-col min-h-[320px] lg:min-h-[calc(100vh-12rem)]">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/40">
        <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
          <MonitorSmartphone className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate font-medium text-foreground">{t("cms.livePreview")}</span>
          <span className="truncate">
            /{form.isHome ? "" : form.slug || "draft"}
          </span>
        </div>
        <span
          className={cn(
            "text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded",
            form.published ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
          )}
        >
          {form.published ? t("crm.published") : t("crm.draft")}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto bg-white dark:bg-background">
        <CmsBlocksView document={doc} primary={primary} />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {meta}
      {tabs}
      {livePreview ? (
        <div className="grid lg:grid-cols-2 gap-4 items-start">
          <div className={cn(mobilePreview && "hidden lg:block")}>{contentPanel}</div>
          <div
            className={cn(
              "lg:sticky lg:top-4",
              !mobilePreview && "hidden lg:block",
              mobilePreview && "block"
            )}
          >
            {previewPanel}
          </div>
        </div>
      ) : (
        contentPanel
      )}
    </div>
  );
}

function BlockFields({
  block,
  onChange,
}: {
  block: CmsBlock;
  onChange: (b: CmsBlock) => void;
}) {
  const { t } = useTranslation();
  if (block.type === "hero") {
    const d = block.data;
    return (
      <div className="grid gap-2">
        <Input
          placeholder={t("cms.fields.eyebrow")}
          value={d.eyebrow || ""}
          onChange={(e) => onChange({ ...block, data: { ...d, eyebrow: e.target.value } })}
        />
        <Input
          placeholder={t("cms.fields.headline")}
          value={d.headline}
          onChange={(e) => onChange({ ...block, data: { ...d, headline: e.target.value } })}
        />
        <Textarea
          placeholder={t("cms.fields.subheadline")}
          rows={2}
          value={d.subheadline || ""}
          onChange={(e) => onChange({ ...block, data: { ...d, subheadline: e.target.value } })}
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder={t("cms.fields.ctaLabel")}
            value={d.ctaLabel || ""}
            onChange={(e) => onChange({ ...block, data: { ...d, ctaLabel: e.target.value } })}
          />
          <Input
            placeholder={t("cms.fields.ctaHref")}
            value={d.ctaHref || ""}
            onChange={(e) => onChange({ ...block, data: { ...d, ctaHref: e.target.value } })}
          />
        </div>
      </div>
    );
  }
  if (block.type === "richText") {
    return (
      <Textarea
        rows={5}
        value={block.data.body}
        onChange={(e) => onChange({ ...block, data: { body: e.target.value } })}
      />
    );
  }
  if (block.type === "features") {
    return (
      <div className="space-y-2">
        <Input
          placeholder={t("cms.fields.sectionTitle")}
          value={block.data.title || ""}
          onChange={(e) => onChange({ ...block, data: { ...block.data, title: e.target.value } })}
        />
        {block.data.items.map((item, i) => (
          <div key={i} className="grid gap-1 rounded-lg border border-border p-2">
            <Input
              placeholder={t("cms.fields.itemTitle")}
              value={item.title}
              onChange={(e) => {
                const items = [...block.data.items];
                items[i] = { ...item, title: e.target.value };
                onChange({ ...block, data: { ...block.data, items } });
              }}
            />
            <Input
              placeholder={t("cms.fields.itemDesc")}
              value={item.description || ""}
              onChange={(e) => {
                const items = [...block.data.items];
                items[i] = { ...item, description: e.target.value };
                onChange({ ...block, data: { ...block.data, items } });
              }}
            />
          </div>
        ))}
      </div>
    );
  }
  if (block.type === "cta") {
    const d = block.data;
    return (
      <div className="grid gap-2">
        <Input
          value={d.title}
          onChange={(e) => onChange({ ...block, data: { ...d, title: e.target.value } })}
          placeholder={t("cms.fields.headline")}
        />
        <Textarea
          rows={2}
          value={d.body || ""}
          onChange={(e) => onChange({ ...block, data: { ...d, body: e.target.value } })}
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={d.buttonLabel || ""}
            onChange={(e) => onChange({ ...block, data: { ...d, buttonLabel: e.target.value } })}
            placeholder={t("cms.fields.ctaLabel")}
          />
          <Input
            value={d.buttonHref || ""}
            onChange={(e) => onChange({ ...block, data: { ...d, buttonHref: e.target.value } })}
            placeholder={t("cms.fields.ctaHref")}
          />
        </div>
      </div>
    );
  }
  if (block.type === "contact") {
    const d = block.data;
    return (
      <div className="grid gap-2">
        <Input
          value={d.title || ""}
          onChange={(e) => onChange({ ...block, data: { ...d, title: e.target.value } })}
          placeholder={t("cms.fields.sectionTitle")}
        />
        <Input
          value={d.email || ""}
          onChange={(e) => onChange({ ...block, data: { ...d, email: e.target.value } })}
          placeholder="Email"
        />
        <Input
          value={d.phone || ""}
          onChange={(e) => onChange({ ...block, data: { ...d, phone: e.target.value } })}
          placeholder="Phone"
        />
        <Textarea
          rows={2}
          value={d.address || ""}
          onChange={(e) => onChange({ ...block, data: { ...d, address: e.target.value } })}
          placeholder={t("cms.fields.address")}
        />
      </div>
    );
  }
  if (block.type === "image") {
    const d = block.data;
    return (
      <div className="grid gap-2">
        <Input
          value={d.url}
          onChange={(e) => onChange({ ...block, data: { ...d, url: e.target.value } })}
          placeholder="https://…"
        />
        <Input
          value={d.alt || ""}
          onChange={(e) => onChange({ ...block, data: { ...d, alt: e.target.value } })}
          placeholder="Alt text"
        />
        <Input
          value={d.caption || ""}
          onChange={(e) => onChange({ ...block, data: { ...d, caption: e.target.value } })}
          placeholder="Caption"
        />
      </div>
    );
  }
  return <p className="text-xs text-muted-foreground">{t("cms.dividerHint")}</p>;
}
