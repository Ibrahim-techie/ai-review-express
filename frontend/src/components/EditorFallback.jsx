/** Placeholder while Monaco loads. Kept apart so it doesn't pull Monaco into the main bundle. */
export function EditorFallback() {
  return <div className="size-full bg-black/[0.03] motion-safe:animate-pulse dark:bg-white/[0.03]" />;
}
