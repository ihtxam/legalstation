import { useState, useRef } from "react";
import { FileText, Upload, Download, Lock, Globe, Trash2, Share2, History, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { DocumentSummaryCard } from "./DocumentSummaryCard";
import { DocumentVersionHistory } from "./DocumentVersionHistory";
import { useTranslation } from "react-i18next";

interface DocumentExchangeProps {
  docs: any[];
  isLoading: boolean;
  onUpload: (file: File, folderId?: number) => Promise<void>;
  onToggleVisibility: (id: number, visibility: "internal" | "shared") => void;
  onDelete: (id: number) => void;
  onDownload: (id: number, name: string) => void;
  canUpload: boolean;
  canShare: boolean;
  summaries?: Record<number, any>;
  summariesLoading?: Record<number, boolean>;
}

export function DocumentExchange({
  docs,
  isLoading,
  onUpload,
  onToggleVisibility,
  onDelete,
  onDownload,
  canUpload,
  canShare,
  summaries = {},
  summariesLoading = {},
}: DocumentExchangeProps) {
  const { t } = useTranslation();
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [versionDocId, setVersionDocId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files?.[0]) {
      setSelectedFile(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      await onUpload(selectedFile);
      setSelectedFile(null);
      setShowUpload(false);
      toast.success(t("docs.uploaded"));
    } catch (error) {
      toast.error(t("docs.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes("pdf")) return "📄";
    if (mimeType.includes("image")) return "🖼️";
    if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
    if (mimeType.includes("sheet") || mimeType.includes("spreadsheet")) return "📊";
    return "📎";
  };

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      {canUpload && (
        <div className="flex justify-end">
          <Button
            size="sm"
            className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white"
            onClick={() => setShowUpload(true)}
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" /> {t("docs.uploadDocument")}
          </Button>
        </div>
      )}

      {/* Documents Grid */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !docs?.length ? (
        <div className="py-12 text-center">
          <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{t("docs.empty")}</p>
          {canUpload && (
            <p className="text-xs text-muted-foreground mt-2">
              {t("docs.emptyHint")}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {docs.map(({ doc }) => (
            <div key={doc.id} className="space-y-3">
              <div
                className="bg-card border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors"
              >
              <div className="flex items-start gap-3">
                {/* File Icon */}
                <div className="text-2xl mt-0.5 shrink-0">
                  {getFileIcon(doc.mimeType)}
                </div>

                {/* Document Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-sm font-medium text-foreground truncate">
                      {doc.name}
                    </h3>
                    <Badge
                      variant="outline"
                      className={
                        doc.visibility === "shared"
                          ? "bg-teal-50 text-teal-700 border-teal-200"
                          : "bg-purple-50 text-purple-700 border-purple-200"
                      }
                    >
                      {doc.visibility === "shared" ? (
                        <>
                          <Globe className="w-3 h-3 mr-1" /> {t("docs.shared")}
                        </>
                      ) : (
                        <>
                          <Lock className="w-3 h-3 mr-1" /> {t("docs.private")}
                        </>
                      )}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {(doc.size / 1024).toFixed(1)} KB • v{doc.currentVersion} •{" "}
                    {format(new Date(doc.createdAt), "dd MMM yyyy")}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Download */}
                  <button
                    title={t("docs.download")}
                    onClick={() => onDownload(doc.id, doc.name)}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  <button
                    title={t("docs.versionHistory")}
                    onClick={() => setVersionDocId(doc.id)}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                  >
                    <History className="w-4 h-4" />
                  </button>

                  {/* Share (if user can manage) */}
                  {canShare && (
                    <button
                      title={t("docs.manageSharing")}
                      onClick={() => {
                        setSelectedDoc(doc);
                        setShowShareDialog(true);
                      }}
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  )}

                  {/* Delete (if user can manage) */}
                  {canShare && (
                    <button
                      title={t("docs.delete")}
                      onClick={() => {
                        if (confirm(t("docs.deleteConfirm"))) {
                          onDelete(doc.id);
                          toast.success(t("docs.deleted"));
                        }
                      }}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              </div>
              {(summaries[doc.id] || summariesLoading[doc.id]) && (
                <DocumentSummaryCard
                  summary={summaries[doc.id]}
                  isLoading={!!summariesLoading[doc.id] && !summaries[doc.id]}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("docs.uploadDocument")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Drag & Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? "border-[var(--color-navy)] bg-[var(--color-navy)]/5"
                  : "border-border hover:border-[var(--color-navy)]/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />

              {selectedFile ? (
                <div className="space-y-2">
                  <CheckCircle className="w-8 h-8 text-green-600 mx-auto" />
                  <p className="text-sm font-medium text-foreground">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto" />
                  <p className="text-sm font-medium text-foreground">
                    {t("docs.dropPrompt")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("docs.browseHint")}
                  </p>
                </div>
              )}

              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 text-sm text-[var(--color-navy)] hover:underline"
              >
                {t("docs.browseFiles")}
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={!selectedFile || uploading}
              onClick={handleUpload}
              className="bg-[var(--color-navy)] hover:bg-[var(--color-navy-light)] text-white"
            >
              {uploading ? t("docs.uploading") : t("docs.upload")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      {selectedDoc && (
        <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("docs.manageSharing")}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm font-medium text-foreground">
                  {selectedDoc.name}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="flex items-center gap-2">
                    {selectedDoc.visibility === "shared" ? (
                      <>
                        <Globe className="w-4 h-4 text-teal-600" />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {t("docs.shared")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("docs.clientCanView")}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 text-purple-600" />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {t("docs.private")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("docs.firmOnly")}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onToggleVisibility(
                        selectedDoc.id,
                        selectedDoc.visibility === "shared"
                          ? "internal"
                          : "shared"
                      );
                      setShowShareDialog(false);
                      toast.success(t("docs.sharingUpdated"));
                    }}
                  >
                    {selectedDoc.visibility === "shared"
                      ? t("docs.makePrivate")
                      : t("docs.share")}
                  </Button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-900">
                  💡 {t("docs.sharingHint")}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowShareDialog(false)}>
                {t("common.close")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <DocumentVersionHistory
        documentId={versionDocId}
        open={versionDocId != null}
        onOpenChange={(open) => {
          if (!open) setVersionDocId(null);
        }}
      />
    </div>
  );
}
