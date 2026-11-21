// The Markdown pipeline (react-markdown, micromark, sanitizer) is only needed
// once a finding is opened, so it is loaded on demand and preloaded as soon
// as a review arrives.
export const loadMarkdown = () => import("@/components/Markdown");
