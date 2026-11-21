import { ChevronDown } from "lucide-react";
import { Suspense, lazy } from "react";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_LABEL, PROVIDER_LABEL, SEVERITY } from "@/lib/review";
import { loadMarkdown } from "@/lib/loadMarkdown";
import { cn } from "@/lib/utils";

const Markdown = lazy(() => loadMarkdown().then((m) => ({ default: m.Markdown })));

function Prose({ children }) {
  return (
    <Suspense fallback={<Skeleton className="h-12 w-full" />}>
      <Markdown>{children}</Markdown>
    </Suspense>
  );
}

const shortLine = (i) =>
  i.line === 0 ? "File" : i.endLine > i.line ? `L${i.line}-${i.endLine}` : `L${i.line}`;

/**
 * One finding. Selecting it opens the explanation and highlights the lines in
 * the editor.
 */
export function FindingItem({ issue, open, onSelect }) {
  const severity = SEVERITY[issue.severity];
  const foundBy = issue.sources.map((s) => PROVIDER_LABEL[s]).join(" and ");

  return (
    <li className="border-b border-card-edge last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onSelect(issue)}
        className={cn(
          "flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
          open ? "bg-black/[0.03] dark:bg-white/[0.03]" : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]",
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip tone={severity.chip}>{severity.label}</Chip>
            {issue.confirmed && <Chip tone="special">Both models</Chip>}
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{shortLine(issue)}</span>
            <span className="text-[11px] text-muted-foreground">{CATEGORY_LABEL[issue.category]}</span>
          </div>
          <p className="mt-1.5 text-sm leading-snug font-medium text-pretty">{issue.title}</p>
        </div>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="space-y-4 px-4 pt-1 pb-5 motion-safe:animate-chai-fade">
          {issue.explanation && <Prose>{issue.explanation}</Prose>}
          {issue.suggestion && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Suggested fix</p>
              <Prose>{issue.suggestion}</Prose>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Found by {foundBy}</p>
        </div>
      )}
    </li>
  );
}
