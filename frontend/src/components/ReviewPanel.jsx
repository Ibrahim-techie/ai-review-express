import { Check, Copy, FileCode2 } from "lucide-react";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { FindingItem } from "@/components/FindingItem";
import { loadMarkdown } from "@/lib/loadMarkdown";
import { ProviderStatus } from "@/components/ProviderStatus";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EditorFallback } from "@/components/EditorFallback";
import { PROVIDER_LABEL, SEVERITY, SEVERITY_ORDER, countBySeverity, scoreBand } from "@/lib/review";

const DiffView = lazy(() => import("@/components/DiffView"));

function EmptyState({ onLoadSample }) {
  return (
    <div className="flex h-full flex-col justify-center gap-6 px-6 py-10">
      <div className="space-y-1.5">
        <h2 className="font-montserrat text-lg font-semibold">No review yet</h2>
        <p className="text-sm text-muted-foreground">
          Paste code in the editor or open a file, then press Review code.
        </p>
      </div>
      <ul className="space-y-3 text-sm text-neutral-700 dark:text-neutral-300">
        <li className="flex gap-3">
          <span className="mt-0.5 font-mono text-[11px] text-muted-foreground">01</span>
          Every finding is pinned to its line, and marked beside it in the editor.
        </li>
        <li className="flex gap-3">
          <span className="mt-0.5 font-mono text-[11px] text-muted-foreground">02</span>
          Cross-check runs Groq and Gemini separately and marks the issues both of them found.
        </li>
        <li className="flex gap-3">
          <span className="mt-0.5 font-mono text-[11px] text-muted-foreground">03</span>
          The Changes tab shows a corrected version you can apply in one step.
        </li>
      </ul>
      <div>
        <Button variant="muted" onClick={onLoadSample}>
          <FileCode2 aria-hidden="true" /> Try a sample
        </Button>
      </div>
    </div>
  );
}

function Waiting() {
  return (
    <div className="space-y-5 p-4" aria-hidden="true">
      <div className="flex items-end gap-4">
        <Skeleton className="h-12 w-20" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
      <Skeleton className="h-1.5 w-full" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      {[0, 1, 2].map((n) => (
        <div key={n} className="space-y-2 pt-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

function Score({ review }) {
  const band = scoreBand(review.score);
  const counts = countBySeverity(review.issues);
  const confirmed = review.issues.filter((i) => i.confirmed).length;
  const parts = SEVERITY_ORDER.filter((s) => counts[s]).map((s) => (
    <span key={s} className={SEVERITY[s].text}>
      {counts[s]} {SEVERITY[s].label.toLowerCase()}
    </span>
  ));

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-4">
        <p className="font-montserrat leading-none">
          <span className="text-5xl font-semibold tracking-tight tabular-nums">{review.score}</span>
          <span className="ml-1 text-sm text-muted-foreground">/100</span>
        </p>
        <div className="min-w-0 pb-0.5 text-sm">
          <p className={`font-medium ${band.text}`}>{band.label}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {parts.length ? parts.reduce((acc, el, i) => (i ? [...acc, ", ", el] : [el]), []) : "No issues found"}
            {confirmed > 0 && `. ${confirmed} confirmed by both models`}
          </p>
        </div>
      </div>
      <Progress value={review.score} aria-label={`Score ${review.score} out of 100`} />
    </div>
  );
}

function Notices({ state }) {
  const { status, providers, final, cancelled, error } = state;
  const running = Object.entries(providers).filter(([, p]) => ["queued", "running", "retrying"].includes(p.state));
  return (
    <>
      {status === "running" && running.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {running.map(([n]) => PROVIDER_LABEL[n]).join(" and ")} still reviewing. Findings are merged when{" "}
          {running.length > 1 ? "they finish" : "it finishes"}.
        </p>
      )}
      {cancelled && !final && (
        <p className="text-xs text-muted-foreground">Stopped early. Showing the review that had already arrived.</p>
      )}
      {status === "error" && error && <Alert tone="danger" title="Review failed">{error.message}</Alert>}
    </>
  );
}

export function ReviewPanel({ state, now, onLoadSample, activeIssueId, onSelectIssue, onApply, onCopy, onCopyCode, editorCode, language, theme }) {
  const [tab, setTab] = useState("findings");
  const [wide, setWide] = useState(true);
  const diffBox = useRef(null);
  const { review, status, error, reviewedCode } = state;
  const running = status === "running";

  // Side-by-side diff only when there is room for two readable columns.
  useEffect(() => {
    const el = diffBox.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWide(entry.contentRect.width >= 760));
    ro.observe(el);
    return () => ro.disconnect();
  }, [tab]);

  // Fetch the Markdown renderer as soon as there is something to read.
  useEffect(() => {
    if (review) loadMarkdown().catch(() => {});
  }, [review]);

  const hasChanges = Boolean(review?.improvedCode) && review.improvedCode !== reviewedCode;
  const editorMoved = Boolean(review) && editorCode !== reviewedCode;

  return (
    <section aria-label="Review" className="card-chai flex min-h-105 flex-col overflow-hidden lg:h-170">
      <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1 gap-0">
        <div className="flex items-center justify-between gap-3 px-4 pt-2.5">
          <TabsList className="border-0">
            <TabsTrigger value="findings">
              Findings
              {review && <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{review.issues.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="changes" disabled={!review}>
              Changes
            </TabsTrigger>
          </TabsList>
          <div className="-mt-1 flex items-center gap-2">
            {state.cached && <Chip>From cache</Chip>}
            {review && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <IconButton variant="ghost" aria-label="Copy review as Markdown" onClick={onCopy} className="size-8">
                    <Copy />
                  </IconButton>
                </TooltipTrigger>
                <TooltipContent>Copy review as Markdown</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        <div className="border-b border-card-edge" />

        <ProviderStatus providers={state.providers} now={now} />

        <TabsContent value="findings" className="min-h-0 flex-1 overflow-y-auto">
          {!review && status === "idle" && <EmptyState onLoadSample={onLoadSample} />}
          {!review && running && <Waiting />}
          {!review && status === "error" && (
            <div className="p-4">
              <Alert tone="danger" title="Review failed">
                <p>{error.message}</p>
                {error.details?.providers && (
                  <ul className="mt-2 space-y-1">
                    {error.details.providers.map((p) => (
                      <li key={p.provider}>
                        {PROVIDER_LABEL[p.provider]}: {p.message}
                      </li>
                    ))}
                  </ul>
                )}
              </Alert>
            </div>
          )}

          {review && (
            <div>
              <div className="space-y-4 p-4">
                <Score review={review} />
                <Notices state={state} />
                {review.summary && (
                  <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">{review.summary}</p>
                )}
              </div>

              {review.issues.length > 0 && (
                <ul className="border-t border-card-edge" aria-label="Findings">
                  {review.issues.map((issue) => (
                    <FindingItem
                      key={issue.id}
                      issue={issue}
                      open={issue.id === activeIssueId}
                      onSelect={onSelectIssue}
                    />
                  ))}
                </ul>
              )}

              {review.strengths.length > 0 && (
                <div className="space-y-2.5 border-t border-card-edge p-4">
                  <h3 className="font-montserrat text-sm font-semibold">What works well</h3>
                  <ul className="space-y-2">
                    {review.strengths.map((s) => (
                      <li key={s} className="flex gap-2.5 text-sm text-neutral-700 dark:text-neutral-300">
                        <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="changes" className="flex min-h-0 flex-1 flex-col">
          {review && !hasChanges && (
            <p className="p-4 text-sm text-muted-foreground">No changes suggested for this code.</p>
          )}
          {review && hasChanges && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <p className="max-w-sm text-xs text-muted-foreground">
                  {editorMoved
                    ? "The editor changed after this review. Applying replaces what is there now."
                    : "Your code with the critical, high and medium findings fixed."}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={onCopyCode}>
                    Copy
                  </Button>
                  <Button size="sm" onClick={onApply} disabled={running}>
                    Apply to editor
                  </Button>
                </div>
              </div>
              <div ref={diffBox} className="min-h-90 flex-1 border-t border-card-edge">
                <Suspense fallback={<EditorFallback />}>
                  <DiffView
                    original={reviewedCode}
                    modified={review.improvedCode}
                    language={language}
                    theme={theme}
                    sideBySide={wide}
                  />
                </Suspense>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
