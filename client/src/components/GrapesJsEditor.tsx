import { useEffect, useRef } from "react";
import grapesjs, { type Editor } from "grapesjs";
import webpagePlugin from "grapesjs-preset-webpage";
import "grapesjs/dist/css/grapes.min.css";
import {
  emptyGrapesDocument,
  parseGrapesDocument,
  serializeGrapesDocument,
  type GrapesPageDocument,
} from "@shared/grapesPage";

type Props = {
  content: string;
  onChange: (serialized: string) => void;
  firmName?: string;
  height?: string;
};

/**
 * Real drag-and-drop visual page builder (GrapesJS + webpage preset).
 * Persists HTML/CSS + project JSON into firm_pages.content.
 */
export default function GrapesJsEditor({ content, onChange, firmName, height = "70vh" }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!hostRef.current || editorRef.current) return;

    const initial = parseGrapesDocument(content) || emptyGrapesDocument(firmName);

    const editor = grapesjs.init({
      container: hostRef.current,
      height,
      width: "auto",
      fromElement: false,
      storageManager: false,
      noticeOnUnload: false,
      canvas: {
        styles: [
          "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,700&display=swap",
        ],
      },
      plugins: [webpagePlugin],
      pluginsOpts: {
        [webpagePlugin as unknown as string]: {
          blocks: [
            "link-block",
            "quote",
            "text-basic",
            "column1",
            "column2",
            "column3",
            "column3-7",
            "text",
            "link",
            "image",
            "video",
            "map",
          ],
          modalImportTitle: "Import",
          modalImportLabel:
            '<div style="margin-bottom:10px;font-size:13px;">Paste HTML/CSS here</div>',
          modalImportContent: (ed: Editor) => ed.getHtml() + "<style>" + ed.getCss() + "</style>",
        },
      },
      deviceManager: {
        devices: [
          { name: "Desktop", width: "" },
          { name: "Tablet", width: "768px", widthMedia: "992px" },
          { name: "Mobile", width: "320px", widthMedia: "480px" },
        ],
      },
    });

    if (initial.projectData) {
      try {
        editor.loadProjectData(initial.projectData as object);
      } catch {
        editor.setComponents(initial.html || "");
        editor.setStyle(initial.css || "");
      }
    } else {
      editor.setComponents(initial.html || "");
      editor.setStyle(initial.css || "");
    }

    const persist = () => {
      const doc: GrapesPageDocument = {
        v: 2,
        format: "grapes",
        html: editor.getHtml() || "",
        css: editor.getCss() || "",
        projectData: editor.getProjectData(),
      };
      onChangeRef.current(serializeGrapesDocument(doc));
    };

    editor.on("update", persist);
    // Initial sync so parent form has grapes JSON even before edits
    persist();

    editorRef.current = editor;

    return () => {
      editor.destroy();
      editorRef.current = null;
    };
    // Mount once per editor instance; content hydration is initial-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-[#1e1e1e]">
      <div ref={hostRef} />
    </div>
  );
}
