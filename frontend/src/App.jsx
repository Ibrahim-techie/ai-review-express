import { ChevronDown, FileUp, LoaderCircle } from "lucide-react";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Backdrop } from "@/components/backdrop";
import { Disclosure, DisclosureContent, DisclosureTrigger } from "@/components/disclosure";
import { EditorFallback } from "@/components/EditorFallback";
import { ReviewPanel } from "@/components/ReviewPanel";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { CheckboxGroup } from "@/components/ui/checkbox-group";
import { Field, Fieldset } from "@/components/ui/field";
import { Highlight } from "@/components/ui/highlight";
import { Kbd } from "@/components/ui/kbd";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useNow } from "@/hooks/useNow";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useReview } from "@/hooks/useReview";
import { fetchMeta } from "@/lib/api";
import { LANGUAGES, languageFromFilename, monacoLanguage } from "@/lib/languages";
import { FOCUS_AREAS, MODES, reviewToMarkdown } from "@/lib/review";
import { SAMPLE } from "@/lib/sample";

const CodeEditor = lazy(() => import("@/components/CodeEditor"));

const isMac = /Mac|iPhone|iPad/.test(navigator.userAgentData?.platform ?? navigator.platform ?? "");
const DEFAULT_MAX_CHARS = 60_000;

export default function App() {
  const { theme } = useTheme();
  const toast = useToast();
  const review = useReview();
  const now = useNow(review.status === "running");

  const [code, setCode] = usePersistentState("ai-review:code", "", { delay: 400 });
  const [language, setLanguage] = usePersistentState("ai-review:language", "");
  const [mode, setMode] = usePersistentState("ai-review:mode", "crosscheck");
  const [focus, setFocus] = usePersistentState("ai-review:focus", []);
  const [notes, setNotes] = useState("");
  const [activeIssueId, setActiveIssueId] = useState(null);
  const [maxChars, setMaxChars] = useState(DEFAULT_MAX_CHARS);
  // The review run whose suggested code was applied; its marks no longer fit.
  const [appliedFor, setAppliedFor] = useState(0);

  const editorRef = useRef(null);
  const fileInput = useRef(null);
  const running = review.status === "running";
  const { run } = review;

  useEffect(() => {
    const ac = new AbortController();
    fetchMeta(ac.signal)
      .then((meta) => setMaxChars(meta.maxCodeChars))
      .catch(() => {});
    return () => ac.abort();
  }, []);

  // With "Detect automatically", highlight with whatever the review found.
  const detected = review.review?.language;
  const editorLanguage = language || monacoLanguage(detected);

  const submit = useCallback(() => {
    if (running) return;
    if (!code.trim()) {
      toast("Add some code to review first");
      return;
    }
    if (code.length > maxChars) {
      toast(`That is ${code.length.toLocaleString()} characters. The limit is ${maxChars.toLocaleString()}.`, {
        tone: "danger",
      });
      return;
    }
    setActiveIssueId(null);
    run({ code, language, mode, focus, context: notes.trim() });
  }, [running, code, maxChars, language, mode, focus, notes, run, toast]);

  // Ctrl/Cmd + Enter from anywhere on the page (the editor binds its own).
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit]);

  const loadSample = () => {
    setCode(SAMPLE.code);
    setLanguage(SAMPLE.language);
    toast("Loaded a sample with a few real problems in it");
  };

  const openFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > maxChars * 4) {
      toast(`${file.name} is too large to review`, { tone: "danger" });
      return;
    }
    setCode(await file.text());
    setLanguage(languageFromFilename(file.name));
    toast(`Opened ${file.name}`);
  };

  const selectIssue = (issue) => setActiveIssueId((id) => (id === issue.id ? null : issue.id));

  const applyImproved = () => {
    const editor = editorRef.current;
    const improved = review.review?.improvedCode;
    if (!editor || !improved) return;
    // An edit (not setValue) keeps it on the undo stack.
    editor.pushUndoStop();
    editor.executeEdits("ai-review", [{ range: editor.getModel().getFullModelRange(), text: improved }]);
    editor.pushUndoStop();
    setActiveIssueId(null);
    setAppliedFor(review.startedAt);
    toast(`Applied. Press ${isMac ? "Cmd" : "Ctrl"}+Z in the editor to undo.`, { tone: "success" });
  };

  const copy = async (text, message) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(message, { tone: "success" });
    } catch {
      toast("Copying is blocked in this browser", { tone: "danger" });
    }
  };

  const issues = review.review?.issues;
  // Marks belong to the code that was reviewed; hide them once it's replaced.
  const applied = appliedFor !== 0 && appliedFor === review.startedAt;
  const marks = useMemo(() => (applied || !issues ? [] : issues), [applied, issues]);
  const activeIssue = issues?.find((i) => i.id === activeIssueId) ?? null;
  const lineCount = code ? code.split("\n").length : 0;
  const selectedMode = MODES.find((m) => m.value === mode) ?? MODES[1];

  return (
    <div className="min-h-dvh">
      <Backdrop />
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-6 sm:px-12">
        <div className="space-y-3 pt-4 pb-10 sm:pt-8">
          <h1 className="text-2xl font-medium sm:text-center sm:text-3xl">Code review</h1>
          <p className="mx-auto max-w-3xl text-base text-balance text-neutral-700 sm:text-center sm:text-lg md:text-xl dark:text-neutral-400">
            Groq and Gemini read your code independently, and every finding is pinned to{" "}
            <Highlight>the exact line</Highlight>.
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-2">
            <Segmented
              label="Review mode"
              options={MODES.map(({ value, label }) => ({ value, label }))}
              value={mode}
              onChange={setMode}
              className="w-fit"
            />
            <p className="text-sm text-muted-foreground">{selectedMode.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1 text-xs text-muted-foreground md:inline-flex">
              <Kbd>{isMac ? "Cmd" : "Ctrl"}</Kbd>
              <Kbd>Enter</Kbd>
            </span>
            {running && (
              <Button variant="outline" onClick={review.cancel}>
                Stop
              </Button>
            )}
            <Button
              variant="solid"
              onClick={submit}
              disabled={running}
              iconRight={running ? <LoaderCircle className="motion-safe:animate-spin" /> : undefined}
            >
              {running ? "Reviewing" : "Review code"}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-label="Code" className="card-chai flex h-120 flex-col overflow-hidden lg:h-170">
            <div className="flex items-center gap-2 border-b border-card-edge px-3 py-2.5">
              <Select
                aria-label="Language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="h-8 text-[13px]"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </Select>
              <Button variant="ghost" size="sm" onClick={() => fileInput.current?.click()}>
                <FileUp aria-hidden="true" /> Open file
              </Button>
              <input
                ref={fileInput}
                type="file"
                className="hidden"
                onChange={openFile}
                accept=".js,.mjs,.cjs,.jsx,.ts,.tsx,.py,.java,.c,.h,.cpp,.cc,.hpp,.cs,.go,.rs,.php,.rb,.kt,.swift,.sql,.html,.css,.scss,.sh,.yml,.yaml,.json,.txt,text/*"
              />
              <span className="ml-auto font-mono text-[11px] whitespace-nowrap text-muted-foreground tabular-nums">
                {lineCount} {lineCount === 1 ? "line" : "lines"}
              </span>
            </div>

            <div className="min-h-0 flex-1">
              <Suspense fallback={<EditorFallback />}>
                <CodeEditor
                  value={code}
                  onChange={setCode}
                  language={editorLanguage}
                  theme={theme}
                  issues={marks}
                  activeIssue={activeIssue}
                  onReady={(editor) => (editorRef.current = editor)}
                  onSubmit={submit}
                />
              </Suspense>
            </div>

            <Disclosure className="border-t border-card-edge">
              <DisclosureTrigger className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm">
                <span className="font-medium">Review options</span>
                <span className="ml-auto truncate text-xs text-muted-foreground">
                  {focus.length
                    ? FOCUS_AREAS.filter((f) => focus.includes(f.value))
                        .map((f) => f.label)
                        .join(", ")
                    : "No focus set"}
                  {notes.trim() && ", with notes"}
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-aria-expanded:rotate-180"
                />
              </DisclosureTrigger>
              <DisclosureContent>
                <div className="grid gap-5 px-4 pt-1 pb-4">
                  <Fieldset legend="Pay extra attention to">
                    <CheckboxGroup
                      options={FOCUS_AREAS}
                      value={focus}
                      onChange={setFocus}
                      className="grid-cols-1 gap-3 sm:grid-cols-2"
                    />
                  </Fieldset>
                  <Field
                    label="Notes for the reviewer"
                    hint="What the code is for, or anything the reviewer should know. Optional."
                    aside={`${notes.length}/2000`}
                  >
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      maxLength={2000}
                      rows={2}
                      className="min-h-16"
                      placeholder="For example: this runs on every request, so speed matters"
                    />
                  </Field>
                </div>
              </DisclosureContent>
            </Disclosure>
          </section>

          <ReviewPanel
            state={review}
            now={now}
            onLoadSample={loadSample}
            activeIssueId={activeIssueId}
            onSelectIssue={selectIssue}
            onApply={applyImproved}
            onCopy={() =>
              copy(reviewToMarkdown(review.review, { language: editorLanguage }), "Review copied as Markdown")
            }
            onCopyCode={() => copy(review.review.improvedCode, "Improved code copied")}
            editorCode={code}
            language={editorLanguage}
            theme={theme}
          />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
