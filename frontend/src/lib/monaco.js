// Monaco is bundled and served from our own origin instead of the default
// jsDelivr CDN: no third-party script at runtime, a pinned version, and it
// works under the server's strict Content-Security-Policy.
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import CssWorker from "monaco-editor/language/css/css.worker?worker";
import HtmlWorker from "monaco-editor/language/html/html.worker?worker";
import JsonWorker from "monaco-editor/language/json/json.worker?worker";

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === "json") return new JsonWorker();
    if (label === "css" || label === "scss" || label === "less") return new CssWorker();
    if (label === "html" || label === "handlebars" || label === "razor") return new HtmlWorker();
    return new EditorWorker();
  },
};

// The TypeScript language service (a ~7 MB worker) only adds autocomplete and
// type diagnostics, which a review tool doesn't need, and on pasted snippets
// without their imports it paints every unknown name red. Highlighting is
// separate (Monarch), so switching every TS feature off keeps colours and
// means the worker is never downloaded.
const ts = monaco.typescript ?? monaco.languages.typescript;
const OFF = {
  completionItems: false,
  hovers: false,
  documentSymbols: false,
  definitions: false,
  references: false,
  documentHighlights: false,
  rename: false,
  diagnostics: false,
  documentRangeFormattingEdits: false,
  signatureHelp: false,
  onTypeFormattingEdits: false,
  codeActions: false,
  inlayHints: false,
};
for (const defaults of [ts?.javascriptDefaults, ts?.typescriptDefaults]) {
  defaults?.setModeConfiguration?.(OFF);
}

// Transparent backgrounds let the ChaiUI card (fill + hairline) show through,
// so the editor reads as part of the page rather than a dropped-in widget.
monaco.editor.defineTheme("chai-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#00000000",
    "editorGutter.background": "#00000000",
    "editor.lineHighlightBackground": "#ffffff08",
    "editor.lineHighlightBorder": "#00000000",
    "editorLineNumber.foreground": "#52525b",
    "editorLineNumber.activeForeground": "#a1a1aa",
    "editorIndentGuide.background1": "#ffffff0d",
    "editor.selectionBackground": "#ffffff26",
    "scrollbarSlider.background": "#ffffff14",
    "scrollbarSlider.hoverBackground": "#ffffff24",
    "diffEditor.insertedTextBackground": "#22c55e1f",
    "diffEditor.removedTextBackground": "#ef44441f",
    "diffEditor.insertedLineBackground": "#22c55e12",
    "diffEditor.removedLineBackground": "#ef444412",
  },
});
monaco.editor.defineTheme("chai-light", {
  base: "vs",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#00000000",
    "editorGutter.background": "#00000000",
    "editor.lineHighlightBackground": "#0000000a",
    "editor.lineHighlightBorder": "#00000000",
    "editorLineNumber.foreground": "#a1a1aa",
    "editorLineNumber.activeForeground": "#52525b",
    "scrollbarSlider.background": "#0000001a",
  },
});

loader.config({ monaco });

// Monaco measures glyph widths once; re-measure after the web font arrives
// or the cursor drifts away from the text.
document.fonts?.ready.then(() => monaco.editor.remeasureFonts());

export const monacoTheme = (theme) => (theme === "dark" ? "chai-dark" : "chai-light");

export const EDITOR_FONT = "'Geist Mono Variable', 'Geist Mono', ui-monospace, monospace";

export { monaco };
