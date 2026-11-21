import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { PROVIDER_LABEL, formatSeconds } from "@/lib/review";

function describe(info, now) {
  const elapsed = info.since ? formatSeconds(Math.max(0, now - info.since)) : "";
  switch (info.state) {
    case "queued":
      return { busy: true, text: "Starting" };
    case "running":
      return { busy: true, text: `Reviewing, ${elapsed}` };
    case "retrying":
      return { busy: true, text: `Model busy, trying another (${elapsed})` };
    case "standby":
      return { text: "Standby, used only if the first model fails", tone: "text-muted-foreground" };
    case "done":
      return {
        text: `Done in ${formatSeconds(info.durationMs)}, ${info.issueCount} ${info.issueCount === 1 ? "finding" : "findings"}`,
        tone: "text-green-700 dark:text-green-400",
      };
    case "failed":
      return { text: info.message, tone: "text-red-700 dark:text-red-400" };
    case "skipped":
      return { text: info.message, tone: "text-muted-foreground" };
    default:
      return { text: "", tone: "text-muted-foreground" };
  }
}

/** One line per provider: what it is doing right now, and with which model. */
export function ProviderStatus({ providers, now }) {
  const entries = ["groq", "gemini"].filter((p) => providers[p]).map((p) => [p, providers[p]]);
  if (!entries.length) return null;

  return (
    <div className="grid gap-x-6 gap-y-3 border-b border-card-edge px-4 py-3 sm:grid-cols-2">
      {entries.map(([name, info]) => {
        const status = describe(info, now);
        return (
          <div key={name} className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-montserrat text-sm font-semibold">{PROVIDER_LABEL[name]}</span>
              {info.model && (
                <span className="truncate font-mono text-[11px] text-muted-foreground" title={info.model}>
                  {info.model}
                </span>
              )}
            </div>
            <p
              className={cn("mt-0.5 flex items-center gap-1.5 text-xs", status.tone ?? "text-muted-foreground")}
              title={info.details ?? info.fallbacks?.join("\n") ?? undefined}
            >
              {status.busy && <Spinner label={`${PROVIDER_LABEL[name]} is reviewing`} className="[&_svg]:size-3" />}
              <span className="tabular-nums">{status.text}</span>
            </p>
          </div>
        );
      })}
    </div>
  );
}
