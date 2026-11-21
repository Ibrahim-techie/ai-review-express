import Editor from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import { EditorFallback } from "@/components/EditorFallback";
import { EDITOR_FONT, monaco, monacoTheme } from "@/lib/monaco";
import { SEVERITY } from "@/lib/review";

const RULER_COLOR = {
  critical: "#f87171",
  high: "#f87171",
  medium: "#fde047",
  low: "#a1a1aa",
  info: "#71717a",
};

const OPTIONS = {
  fontFamily: EDITOR_FONT,
  fontSize: 13,
  lineHeight: 20,
  minimap: { enabled: false },
  wordWrap: "on",
  automaticLayout: true,
  scrollBeyondLastLine: false,
  padding: { top: 12, bottom: 12 },
  lineDecorationsWidth: 14,
  renderLineHighlight: "line",
  smoothScrolling: true,
  fixedOverflowWidgets: true,
  tabSize: 2,
  stickyScroll: { enabled: false },
  overviewRulerBorder: false,
  scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
};

/**
 * The code editor. Findings are drawn as thin severity marks beside the line
 * numbers. They are Monaco decorations, so they follow the code if it is
 * edited after the review, and `revealIssue` jumps to where the issue is now.
 */
export default function CodeEditor({ value, onChange, language, theme, issues, activeIssue, onReady, onSubmit }) {
  const editorRef = useRef(null);
  const marks = useRef(null);
  const activeMark = useRef(null);
  const decorationIds = useRef(new Map());
  const submit = useRef(onSubmit);

  useEffect(() => {
    submit.current = onSubmit;
  }, [onSubmit]);

  const handleMount = (editor) => {
    editorRef.current = editor;
    marks.current = editor.createDecorationsCollection();
    activeMark.current = editor.createDecorationsCollection();
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => submit.current?.());
    onReady?.(editor);
  };

  useEffect(() => {
    if (!marks.current) return;
    const located = (issues ?? []).filter((i) => i.line > 0);
    const ids = marks.current.set(
      located.map((i) => ({
        range: new monaco.Range(i.line, 1, i.endLine || i.line, 1),
        options: {
          isWholeLine: true,
          linesDecorationsClassName: `sev-mark ${SEVERITY[i.severity].mark}`,
          overviewRuler: {
            color: RULER_COLOR[i.severity],
            position: monaco.editor.OverviewRulerLane.Right,
          },
          hoverMessage: { value: `**${SEVERITY[i.severity].label}:** ${i.title}` },
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      })),
    );
    decorationIds.current = new Map(located.map((issue, n) => [issue.id, ids[n]]));
  }, [issues]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !activeMark.current) return;
    const decoration = activeIssue && decorationIds.current.get(activeIssue.id);
    const range = decoration && editor.getModel()?.getDecorationRange(decoration);
    if (!range) {
      activeMark.current.clear();
      return;
    }
    activeMark.current.set([{ range, options: { isWholeLine: true, className: "issue-active-line" } }]);
    editor.revealLinesInCenterIfOutsideViewport(range.startLineNumber, range.endLineNumber);
  }, [activeIssue]);

  return (
    <Editor
      height="100%"
      language={language}
      theme={monacoTheme(theme)}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      onMount={handleMount}
      options={OPTIONS}
      loading={<EditorFallback />}
    />
  );
}
