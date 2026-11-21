import { DiffEditor } from "@monaco-editor/react";
import { EDITOR_FONT, monacoTheme } from "@/lib/monaco";
import { EditorFallback } from "@/components/EditorFallback";

/** Original code on the left (or above), the suggested version on the right. */
export default function DiffView({ original, modified, language, theme, sideBySide }) {
  return (
    <DiffEditor
      height="100%"
      original={original}
      modified={modified}
      language={language}
      theme={monacoTheme(theme)}
      loading={<EditorFallback />}
      keepCurrentOriginalModel
      keepCurrentModifiedModel
      options={{
        readOnly: true,
        originalEditable: false,
        renderSideBySide: sideBySide,
        useInlineViewWhenSpaceIsLimited: true,
        hideUnchangedRegions: { enabled: true, contextLineCount: 3 },
        fontFamily: EDITOR_FONT,
        fontSize: 13,
        lineHeight: 20,
        minimap: { enabled: false },
        wordWrap: "on",
        automaticLayout: true,
        scrollBeyondLastLine: false,
        renderOverviewRuler: false,
        padding: { top: 12, bottom: 12 },
        fixedOverflowWidgets: true,
      }}
    />
  );
}
