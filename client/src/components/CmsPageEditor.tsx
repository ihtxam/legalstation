import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CMS_BLOCK_TYPES,
  CMS_DYNAMIC_BLOCK_TYPES,
  CMS_TEMPLATE_IDS,
  type CmsBlock,
  type CmsBlockType,
  type CmsDocument,
  type CmsTemplateId,
  createEmptyBlock,
  cmsTemplate,
  parseCmsDocument,
  reorderBlocks,
  serializeCmsDocument,
} from "@shared/cmsBlocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CmsBlocksView } from "@/components/CmsBlockRenderer";
import {
  Eye,
  GripVertical,
  LayoutTemplate,
  MonitorSmartphone,
  Plus,
  Sparkles,
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

const TEMPLATE_KEYS: Record<CmsTemplateId, string> = {
  classic: "cms.templateClassic",
  modern: "cms.templateModern",
  minimal: "cms.templateMinimal",
  services: "cms.templateServices",
  team: "cms.templateTeam",
  contact: "cms.templateContact",
};

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

  const dragIndex = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

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

  const handleDrop = (targetIndex: number) => {
    const from = dragIndex.current;
    dragIndex.current = null;
    setOverIndex(null);
    if (from == null || from === targetIndex) return;
    setDoc({ v: 1, blocks: reorderBlocks(doc.blocks, from, targetIndex) });
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

  const contentBlockTypes = CMS_BLOCK_TYPES.filter((t) => !CMS_DYNAMIC_BLOCK_TYPES.has(t));
  const dynamicBlockTypes = CMS_BLOCK_TYPES.filter((t) => CMS_DYNAMIC_BLOCK_TYPES.has(t));

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
              {CMS_TEMPLATE_IDS.map((id) => (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => applyTemplate(id)}
                >
                  {t(TEMPLATE_KEYS[id])}
                </Button>
              ))}
            </div>
            <div>
              <p className="text-sm font-medium mb-2">{t("cms.addBlock")}</p>
              <div className="flex flex-wrap gap-1.5">
                {contentBlockTypes.map((type) => (
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
              <p className="text-xs font-medium text-muted-foreground mt-3 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                {t("cms.liveDataBlocks")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {dynamicBlockTypes.map((type) => (
                  <Button
                    key={type}
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="border border-dashed border-[var(--color-navy)]/40"
                    onClick={() =>
                      setDoc({ v: 1, blocks: [...doc.blocks, createEmptyBlock(type)] })
                    }
                  >
                    <Plus className="w-3 h-3 me-1" />
                    {t(`cms.blocks.${type}`)}
                  </Button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">{t("cms.liveDataHint")}</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {doc.blocks.map((block, index) => (
              <div
                key={block.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (overIndex !== index) setOverIndex(index);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(index);
                }}
                className={cn(
                  "rounded-xl border bg-card p-4 space-y-3 transition-colors",
                  overIndex === index && dragIndex.current !== index
                    ? "border-[var(--color-navy)] ring-2 ring-[var(--color-navy)]/30"
                    : "border-border"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      draggable
                      onDragStart={() => {
                        dragIndex.current = index;
                      }}
                      onDragEnd={() => {
                        dragIndex.current = null;
                        setOverIndex(null);
                      }}
                      className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 -ms-1 rounded touch-none"
                      title={t("cms.dragToReorder")}
                    >
                      <GripVertical className="w-4 h-4" />
                    </span>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">
                      {t(`cms.blocks.${block.type as CmsBlockType}`)}
                      {CMS_DYNAMIC_BLOCK_TYPES.has(block.type) && (
                        <span className="ms-1.5 normal-case font-normal text-[10px] text-[var(--color-navy)]">
                          {t("cms.liveBadge")}
                        </span>
                      )}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive shrink-0"
                    onClick={() =>
                      setDoc({ v: 1, blocks: doc.blocks.filter((_, i) => i !== index) })
                    }
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
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
        <CmsBlocksView document={doc} primary={primary} mode="editor" />
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

/** Generic add/remove list helper shared by block types with repeated items. */
function ListEditor<T>({
  items,
  onChange,
  newItem,
  renderItem,
  addLabel,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  newItem: () => T;
  renderItem: (item: T, index: number, update: (next: T) => void) => React.ReactNode;
  addLabel: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="grid gap-1.5 rounded-lg border border-border p-2.5 relative">
          <button
            type="button"
            className="absolute top-1.5 end-1.5 text-muted-foreground hover:text-destructive"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            aria-label="Remove"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <div className="pe-6">
            {renderItem(item, i, (next) => {
              const copy = [...items];
              copy[i] = next;
              onChange(copy);
            })}
          </div>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange([...items, newItem()])}
      >
        <Plus className="w-3.5 h-3.5 me-1" />
        {addLabel}
      </Button>
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
        <ListEditor
          items={block.data.items}
          onChange={(items) => onChange({ ...block, data: { ...block.data, items } })}
          newItem={() => ({ title: "", description: "" })}
          addLabel={t("cms.addItem")}
          renderItem={(item, _i, update) => (
            <>
              <Input
                placeholder={t("cms.fields.itemTitle")}
                value={item.title}
                onChange={(e) => update({ ...item, title: e.target.value })}
              />
              <Input
                placeholder={t("cms.fields.itemDesc")}
                value={item.description || ""}
                onChange={(e) => update({ ...item, description: e.target.value })}
              />
            </>
          )}
        />
      </div>
    );
  }
  if (block.type === "stats") {
    return (
      <div className="space-y-2">
        <Input
          placeholder={t("cms.fields.sectionTitle")}
          value={block.data.title || ""}
          onChange={(e) => onChange({ ...block, data: { ...block.data, title: e.target.value } })}
        />
        <ListEditor
          items={block.data.items}
          onChange={(items) => onChange({ ...block, data: { ...block.data, items } })}
          newItem={() => ({ value: "", label: "" })}
          addLabel={t("cms.addItem")}
          renderItem={(item, _i, update) => (
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder={t("cms.fields.statValue")}
                value={item.value}
                onChange={(e) => update({ ...item, value: e.target.value })}
              />
              <Input
                placeholder={t("cms.fields.statLabel")}
                value={item.label}
                onChange={(e) => update({ ...item, label: e.target.value })}
              />
            </div>
          )}
        />
      </div>
    );
  }
  if (block.type === "testimonials") {
    return (
      <div className="space-y-2">
        <Input
          placeholder={t("cms.fields.sectionTitle")}
          value={block.data.title || ""}
          onChange={(e) => onChange({ ...block, data: { ...block.data, title: e.target.value } })}
        />
        <ListEditor
          items={block.data.items}
          onChange={(items) => onChange({ ...block, data: { ...block.data, items } })}
          newItem={() => ({ quote: "", author: "", role: "" })}
          addLabel={t("cms.addItem")}
          renderItem={(item, _i, update) => (
            <>
              <Textarea
                rows={2}
                placeholder={t("cms.fields.quote")}
                value={item.quote}
                onChange={(e) => update({ ...item, quote: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder={t("cms.fields.author")}
                  value={item.author}
                  onChange={(e) => update({ ...item, author: e.target.value })}
                />
                <Input
                  placeholder={t("cms.fields.role")}
                  value={item.role || ""}
                  onChange={(e) => update({ ...item, role: e.target.value })}
                />
              </div>
            </>
          )}
        />
      </div>
    );
  }
  if (block.type === "team") {
    return (
      <div className="space-y-2">
        <Input
          placeholder={t("cms.fields.sectionTitle")}
          value={block.data.title || ""}
          onChange={(e) => onChange({ ...block, data: { ...block.data, title: e.target.value } })}
        />
        <ListEditor
          items={block.data.items}
          onChange={(items) => onChange({ ...block, data: { ...block.data, items } })}
          newItem={() => ({ name: "", role: "", photoUrl: "", bio: "" })}
          addLabel={t("cms.addItem")}
          renderItem={(item, _i, update) => (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder={t("cms.fields.name")}
                  value={item.name}
                  onChange={(e) => update({ ...item, name: e.target.value })}
                />
                <Input
                  placeholder={t("cms.fields.role")}
                  value={item.role || ""}
                  onChange={(e) => update({ ...item, role: e.target.value })}
                />
              </div>
              <Input
                placeholder={t("cms.fields.photoUrl")}
                value={item.photoUrl || ""}
                onChange={(e) => update({ ...item, photoUrl: e.target.value })}
              />
              <Textarea
                rows={2}
                placeholder={t("cms.fields.bio")}
                value={item.bio || ""}
                onChange={(e) => update({ ...item, bio: e.target.value })}
              />
            </>
          )}
        />
      </div>
    );
  }
  if (block.type === "faq") {
    return (
      <div className="space-y-2">
        <Input
          placeholder={t("cms.fields.sectionTitle")}
          value={block.data.title || ""}
          onChange={(e) => onChange({ ...block, data: { ...block.data, title: e.target.value } })}
        />
        <ListEditor
          items={block.data.items}
          onChange={(items) => onChange({ ...block, data: { ...block.data, items } })}
          newItem={() => ({ question: "", answer: "" })}
          addLabel={t("cms.addItem")}
          renderItem={(item, _i, update) => (
            <>
              <Input
                placeholder={t("cms.fields.question")}
                value={item.question}
                onChange={(e) => update({ ...item, question: e.target.value })}
              />
              <Textarea
                rows={2}
                placeholder={t("cms.fields.answer")}
                value={item.answer}
                onChange={(e) => update({ ...item, answer: e.target.value })}
              />
            </>
          )}
        />
      </div>
    );
  }
  if (block.type === "gallery") {
    return (
      <div className="space-y-2">
        <Input
          placeholder={t("cms.fields.sectionTitle")}
          value={block.data.title || ""}
          onChange={(e) => onChange({ ...block, data: { ...block.data, title: e.target.value } })}
        />
        <ListEditor
          items={block.data.items}
          onChange={(items) => onChange({ ...block, data: { ...block.data, items } })}
          newItem={() => ({ url: "", caption: "" })}
          addLabel={t("cms.addItem")}
          renderItem={(item, _i, update) => (
            <>
              <Input
                placeholder="https://…"
                value={item.url}
                onChange={(e) => update({ ...item, url: e.target.value })}
              />
              <Input
                placeholder={t("cms.fields.caption")}
                value={item.caption || ""}
                onChange={(e) => update({ ...item, caption: e.target.value })}
              />
            </>
          )}
        />
      </div>
    );
  }
  if (block.type === "logos") {
    return (
      <div className="space-y-2">
        <Input
          placeholder={t("cms.fields.sectionTitle")}
          value={block.data.title || ""}
          onChange={(e) => onChange({ ...block, data: { ...block.data, title: e.target.value } })}
        />
        <ListEditor
          items={block.data.items}
          onChange={(items) => onChange({ ...block, data: { ...block.data, items } })}
          newItem={() => ({ name: "", logoUrl: "" })}
          addLabel={t("cms.addItem")}
          renderItem={(item, _i, update) => (
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder={t("cms.fields.name")}
                value={item.name}
                onChange={(e) => update({ ...item, name: e.target.value })}
              />
              <Input
                placeholder={t("cms.fields.logoUrl")}
                value={item.logoUrl || ""}
                onChange={(e) => update({ ...item, logoUrl: e.target.value })}
              />
            </div>
          )}
        />
      </div>
    );
  }
  if (block.type === "packages" || block.type === "services") {
    const d = block.data;
    return (
      <div className="grid gap-2">
        <p className="text-xs text-muted-foreground -mt-1">{t("cms.liveDataHint")}</p>
        <Input
          placeholder={t("cms.fields.sectionTitle")}
          value={d.title || ""}
          onChange={(e) => onChange({ ...block, data: { ...d, title: e.target.value } })}
        />
        <Textarea
          rows={2}
          placeholder={t("cms.fields.subtitle")}
          value={d.subtitle || ""}
          onChange={(e) => onChange({ ...block, data: { ...d, subtitle: e.target.value } })}
        />
        <div className="w-32">
          <Label className="text-xs">{t("cms.fields.limit")}</Label>
          <Input
            className="mt-1"
            type="number"
            min={1}
            max={12}
            value={d.limit ?? 3}
            onChange={(e) =>
              onChange({ ...block, data: { ...d, limit: parseInt(e.target.value, 10) || 3 } })
            }
          />
        </div>
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
